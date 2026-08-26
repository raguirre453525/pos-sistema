using MetraTC.Application.Services.Assistant;
using Microsoft.AspNetCore.Mvc;
using static MetraTC.Application.DTOs.AssistantDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/assistant")]
public class AssistantController : ControllerBase
{
    private readonly IAssistantService _assistantService;
    private readonly ILogger<AssistantController> _logger;

    public AssistantController(IAssistantService assistantService, ILogger<AssistantController> logger)
    {
        _assistantService = assistantService;
        _logger = logger;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequestDto request, CancellationToken ct)
    {
        // Manual validation to keep FluentValidation message style (AutoValidation also covers it)
        if (request == null || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "El mensaje es obligatorio" });
        if (request.Message.Length > 2000)
            return BadRequest(new { message = "El mensaje no puede exceder 2000 caracteres" });

        var history = request.History != null
            ? request.History.Select(h => new ChatMessage(
                h.Role == "assistant" ? "assistant" : "user",
                h.Content)).ToList()
            : new List<ChatMessage>();

        try
        {
            var (reply, provider) = await _assistantService.GetResponseAsync(request.Message, history, ct);
            return Ok(new ChatResponseDto(reply, provider));
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Configura Assistant:OpenAI:ApiKey"))
        {
            return BadRequest(new { message = "Configura Assistant:OpenAI:ApiKey en appsettings.Development.json o variable de entorno Assistant__OpenAI__ApiKey" });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("inválido"))
        {
            return StatusCode(500, new { message = ex.Message });
        }
        catch (NotSupportedException ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(502, new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "OpenAI request failed");
            // 429 already wrapped as InvalidOperationException with 429 prefix
            if (ex.Message.Contains("429"))
                return StatusCode(502, new { message = "OpenAI está con mucho tráfico (429). Probá de nuevo en unos segundos." });
            return StatusCode(502, new { message = "No se pudo contactar a OpenAI. Probá de nuevo más tarde." });
        }
        catch (InvalidOperationException ex) when (ex.Message.StartsWith("429"))
        {
            return StatusCode(502, new { message = "OpenAI está con mucho tráfico (429). Probá de nuevo en unos segundos." });
        }
    }

    [HttpGet("providers")]
    public IActionResult GetProviders()
    {
        var current = _assistantService.CurrentProvider;
        var available = _assistantService.AvailableProviders;
        return Ok(new ProvidersResponseDto(current, available));
    }
}
