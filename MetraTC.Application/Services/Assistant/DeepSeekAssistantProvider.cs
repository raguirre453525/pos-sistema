using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace MetraTC.Application.Services.Assistant;

public class DeepSeekAssistantProvider : IAssistantProvider
{
    public string Name => "deepseek";

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    // Reuse same system prompt as OpenAI provider (MetraTC POS domain)
    public const string SystemPrompt =
        "Sos asistente de MetraTC, un POS para comercio minorista. " +
        "Ayudás con inventario, ventas y reportes. Respondé en español rioplatense, breve y útil. " +
        "Si preguntan por stock, responde con los datos reales del contexto cuando estén disponibles; de lo contrario, explica cómo consultarlos en el sistema. " +
        "Al indicar cantidades de stock, conserva exactamente el valor del contexto: usa punto decimal y no incluyas separadores de miles ni ceros decimales innecesarios. " +
        "Solo propone cambios de inventario cuando el mensaje actual solicite explícitamente una acción; las consultas informativas no deben generar propuestas ni sugerencias de modificación. " +
        "No inventes datos de stock o ventas si no tenés contexto. Sé conciso y amable. " +
        "NUNCA digas que creaste/modificaste un producto en la base de datos. Solo el sistema puede crear productos tras confirmación explícita del usuario (botón Confirmar o 'sí/dale'). Si el usuario pregunta si creaste algo, responde que solo propones y que debe tocar Confirmar.";

    public DeepSeekAssistantProvider(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    internal static string? GetApiKey(IConfiguration configuration)
    {
        var environmentKey = configuration["DEEPSEEK_API_KEY"];
        return string.IsNullOrWhiteSpace(environmentKey) ? configuration["Assistant:DeepSeek:ApiKey"] : environmentKey;
    }

    public Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, CancellationToken ct)
        => GetResponseAsync(message, history, inventoryContext, Array.Empty<AssistantImage>(), ct);

    public async Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, IReadOnlyList<AssistantImage> images, CancellationToken ct)
    {
        var apiKey = GetApiKey(_configuration);
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Configura Assistant:DeepSeek:ApiKey");

        var model = _configuration["Assistant:DeepSeek:Model"];
        if (string.IsNullOrWhiteSpace(model))
            model = "deepseek-flash";

        var systemContent = string.IsNullOrWhiteSpace(inventoryContext)
            ? SystemPrompt
            : SystemPrompt + "\n\nContexto de inventario (datos reales de la DB, no inventes):\n" + inventoryContext;

        var messages = new List<object>
        {
            new { role = "system", content = systemContent }
        };

        // History: keep last 20 to avoid token overflow
        if (history != null)
        {
            foreach (var h in history.TakeLast(20))
            {
                var role = h.Role == "assistant" ? "assistant" : "user";
                messages.Add(new { role, content = h.Content });
            }
        }

        object userContent = message;
        if (images.Count > 0)
        {
            var contentParts = new List<object>();
            if (!string.IsNullOrWhiteSpace(message))
                contentParts.Add(new { type = "text", text = message });
            contentParts.AddRange(images.Select(image => (object)new
            {
                type = "image_url",
                image_url = new { url = image.DataUrl }
            }));
            userContent = contentParts;
        }
        messages.Add(new { role = "user", content = userContent });

        var payload = new
        {
            model,
            messages,
            max_tokens = 800,
            temperature = 0.7,
            thinking = new { type = "disabled" }
        };

        var json = JsonSerializer.Serialize(payload);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.deepseek.com/chat/completions")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new HttpRequestException("No se pudo conectar con DeepSeek. Verificá tu conexión.", ex);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                // Never include the provider response body in exceptions; the controller logs them.
                if ((int)response.StatusCode == 401)
                    throw new UnauthorizedAccessException("DeepSeek ApiKey inválida. Verificá Assistant:DeepSeek:ApiKey.");
                if ((int)response.StatusCode == 429)
                    throw new InvalidOperationException("429: DeepSeek rate limit alcanzado. Probá de nuevo en unos segundos.");
                throw new HttpRequestException($"DeepSeek error {(int)response.StatusCode}.");
            }

            var body = await response.Content.ReadAsStringAsync(ct);
            try
            {
                using var doc = JsonDocument.Parse(body);
                var content = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString();

                return string.IsNullOrWhiteSpace(content)
                    ? "No recibí respuesta del modelo. Probá de nuevo."
                    : content.Trim();
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Respuesta inesperada de DeepSeek: {ex.Message}");
            }
        }
    }

    // Compat overload
    public Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct)
        => GetResponseAsync(message, history, string.Empty, Array.Empty<AssistantImage>(), ct);
}
