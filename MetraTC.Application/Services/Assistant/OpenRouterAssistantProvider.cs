using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;

namespace MetraTC.Application.Services.Assistant;

public sealed class OpenRouterAssistantProvider(HttpClient httpClient, IConfiguration configuration) : IAssistantProvider
{
    public const string FreeModel = "google/gemma-4-31b-it:free";
    public static readonly TimeSpan RequestBudget = TimeSpan.FromSeconds(90);
    public string Name => "openrouter";

    internal static void ValidateConfiguration(IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(configuration["OpenRouter:ApiKey"]))
            throw new InvalidOperationException("Configura OpenRouter:ApiKey");
        var configuredModel = configuration["OpenRouter:Model"];
        if (!string.IsNullOrWhiteSpace(configuredModel) && configuredModel != FreeModel)
            throw new NotSupportedException($"OpenRouter only supports the fixed free model {FreeModel}.");
    }

    internal static HttpRequestMessage CreateRequest(IConfiguration configuration, IReadOnlyList<object> messages, int maxTokens, double temperature, bool jsonOutput = false)
    {
        ValidateConfiguration(configuration);
        var payload = new
        {
            model = FreeModel,
            messages,
            max_tokens = maxTokens,
            temperature,
            response_format = jsonOutput ? new { type = "json_object" } : null,
            provider = new
            {
                allow_fallbacks = false,
                require_parameters = true,
                max_price = new { prompt = "0", completion = "0", request = "0", image = "0" }
            }
        };
        var request = new HttpRequestMessage(HttpMethod.Post, "https://openrouter.ai/api/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            }), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", configuration["OpenRouter:ApiKey"]);
        return request;
    }

    internal static async Task<string> CompleteAsync(HttpClient client, HttpRequestMessage request, CancellationToken ct)
    {
        using var response = await DeepSeekAssistantProvider.SendAsync(client, request, ct, RequestBudget, "OpenRouter");
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException("OpenRouter ApiKey no válida. Verifica OpenRouter:ApiKey.");
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"OpenRouter error {(int)response.StatusCode}.");
        // Never expose provider response bodies, including errors returned inside HTTP 200.
        return DeepSeekAssistantProvider.ReadCompletedContent(await response.Content.ReadAsStringAsync(ct), "OpenRouter").Trim();
    }

    public Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, CancellationToken ct)
        => GetResponseAsync(message, history, inventoryContext, [], ct);

    public async Task<string> GetResponseAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, IReadOnlyList<AssistantImage> images, CancellationToken ct)
    {
        var system = string.IsNullOrWhiteSpace(inventoryContext)
            ? OpenAiAssistantProvider.SystemPrompt
            : OpenAiAssistantProvider.SystemPrompt + "\n\nInventory context (real database values; do not invent):\n" + inventoryContext;
        var messages = new List<object> { new { role = "system", content = system } };
        foreach (var item in history.TakeLast(20))
            messages.Add(new { role = item.Role == "assistant" ? "assistant" : "user", content = item.Content });

        object userContent = message;
        if (images.Count > 0)
        {
            var parts = new List<object>();
            if (!string.IsNullOrWhiteSpace(message)) parts.Add(new { type = "text", text = message });
            parts.AddRange(images.Select(image => (object)new { type = "image_url", image_url = new { url = image.DataUrl } }));
            userContent = parts;
        }
        messages.Add(new { role = "user", content = userContent });
        using var request = CreateRequest(configuration, messages, 800, 0.7);
        return await CompleteAsync(httpClient, request, ct);
    }
}
