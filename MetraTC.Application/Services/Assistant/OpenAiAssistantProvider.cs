using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace MetraTC.Application.Services.Assistant;

public class OpenAiAssistantProvider : IAssistantProvider
{
    public string Name => "openai";

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    // System prompt for MetraTC POS domain
    public const string SystemPrompt =
        "Sos asistente de MetraTC, un POS para comercio minorista. " +
        "Ayudás con inventario, ventas y reportes. Respondé en español rioplatense, breve y útil. " +
        "Si te preguntan por stock, productos o ventas, explicá cómo consultarlos en el sistema. " +
        "No inventes datos de stock o ventas si no tenés contexto. Sé conciso y amable.";

    public OpenAiAssistantProvider(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, CancellationToken ct)
    {
        var apiKey = _configuration["Assistant:OpenAI:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Configura Assistant:OpenAI:ApiKey");

        var model = _configuration["Assistant:OpenAI:Model"];
        if (string.IsNullOrWhiteSpace(model))
            model = "gpt-4o-mini";

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

        messages.Add(new { role = "user", content = message });

        var payload = new
        {
            model,
            messages,
            max_tokens = 800,
            temperature = 0.7
        };

        var json = JsonSerializer.Serialize(payload);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
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
            throw new HttpRequestException("No se pudo conectar con OpenAI. Verificá tu conexión.", ex);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            // Map OpenAI errors to meaningful exceptions for controller
            if ((int)response.StatusCode == 401)
                throw new UnauthorizedAccessException("OpenAI ApiKey inválida. Verificá Assistant:OpenAI:ApiKey.");
            if ((int)response.StatusCode == 429)
                throw new InvalidOperationException("429: OpenAI rate limit alcanzado. Probá de nuevo en unos segundos.");
            // Generic 5xx / 502
            throw new HttpRequestException($"OpenAI error {(int)response.StatusCode}: {body}");
        }

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
            throw new InvalidOperationException($"Respuesta inesperada de OpenAI: {ex.Message}");
        }
    }

    // Compat overload
    public Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct)
        => GetResponseAsync(message, history, string.Empty, ct);
}
