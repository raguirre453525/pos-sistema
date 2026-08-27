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
        "Si te preguntan por stock, productos o ventas, explicá cómo consultarlos en el sistema. " +
        "No inventes datos de stock o ventas si no tenés contexto. Sé conciso y amable.";

    public DeepSeekAssistantProvider(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, CancellationToken ct)
    {
        var apiKey = _configuration["Assistant:DeepSeek:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Configura Assistant:DeepSeek:ApiKey");

        var model = _configuration["Assistant:DeepSeek:Model"];
        if (string.IsNullOrWhiteSpace(model))
            model = "deepseek-v4-flash"; // V4 Flash = deepseek flash (default). Alternatives: deepseek-v4-pro, legacy deepseek-chat/reasoner (retiran 2026-07-24)

        var messages = new List<object>
        {
            new { role = "system", content = SystemPrompt }
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

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            // Map DeepSeek errors (OpenAI-compatible) to meaningful exceptions for controller
            if ((int)response.StatusCode == 401)
                throw new UnauthorizedAccessException("DeepSeek ApiKey inválida. Verificá Assistant:DeepSeek:ApiKey.");
            if ((int)response.StatusCode == 429)
                throw new InvalidOperationException("429: DeepSeek rate limit alcanzado. Probá de nuevo en unos segundos.");
            throw new HttpRequestException($"DeepSeek error {(int)response.StatusCode}: {body}");
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
            throw new InvalidOperationException($"Respuesta inesperada de DeepSeek: {ex.Message}");
        }
    }
}
