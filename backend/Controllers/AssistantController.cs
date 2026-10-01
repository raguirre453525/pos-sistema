using System.Security.Claims;
using MetraTC.Application.Services.Assistant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static MetraTC.Application.DTOs.AssistantDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/assistant")]
[Authorize]
public class AssistantController : ControllerBase
{
    private readonly IAssistantService _assistantService;
    private readonly ILogger<AssistantController> _logger;

    public AssistantController(IAssistantService assistantService, ILogger<AssistantController> logger)
    {
        _assistantService = assistantService;
        _logger = logger;
    }

    private bool TryGetCallerScope(out Guid businessId, out Guid userId)
    {
        businessId = Guid.Empty;
        userId = Guid.Empty;

        var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase)) return false;

        var businessClaim = User.FindFirst("businessId")?.Value;
        var userClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(businessClaim, out businessId) && businessId != Guid.Empty &&
            Guid.TryParse(userClaim, out userId) && userId != Guid.Empty;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequestDto request, CancellationToken ct)
    {
        if (!TryGetCallerScope(out var businessId, out var userId))
            return Forbid();
        if (request == null)
            return BadRequest(new { message = "El mensaje es obligatorio" });

        var message = request.Message?.Trim() ?? string.Empty;
        if (message.Length > 2000)
            return BadRequest(new { message = "El mensaje no puede exceder 2000 caracteres" });
        if (!AssistantImageValidator.TryParse(request.Images, out var images, out var imageError))
            return BadRequest(new { message = imageError });
        if (string.IsNullOrWhiteSpace(message) && images.Count == 0)
            return BadRequest(new { message = "Escribe un mensaje o adjunta una imagen." });
        if (request.History?.Count > 20)
            return BadRequest(new { message = "El historial no puede exceder 20 mensajes" });
        if (request.History?.Any(h => h == null || h.Content == null || h.Content.Length > 2000 || (h.Role != "user" && h.Role != "assistant")) == true)
            return BadRequest(new { message = "El historial contiene un mensaje no válido" });

        if (images.Count > 0 && string.IsNullOrWhiteSpace(message))
            message = "Describe las imágenes adjuntas.";

        var history = request.History != null
            ? request.History.Select(h => new ChatMessage(
                h.Role,
                h.Content)).ToList()
            : new List<ChatMessage>();

        try
        {
            var canConfirmStockAdjustments = User.IsInRole("Admin");
            var (reply, provider, proposal) = await _assistantService.GetResponseAsync(message, history, images, businessId, userId, canConfirmStockAdjustments, ct);
            return Ok(new ChatResponseDto(reply, provider, proposal));
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Configura Assistant:OpenAI:ApiKey"))
        {
            return BadRequest(new { message = "Configura Assistant:OpenAI:ApiKey en appsettings.Development.json o variable de entorno Assistant__OpenAI__ApiKey" });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Configura Assistant:DeepSeek:ApiKey"))
        {
            return BadRequest(new { message = "Configura DEEPSEEK_API_KEY en el entorno del backend." });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("inválido"))
        {
            return StatusCode(500, new { message = ex.Message });
        }
        catch (NotSupportedException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(502, new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Assistant provider request failed");
            // 429 already wrapped as InvalidOperationException with 429 prefix
            if (ex.Message.Contains("429"))
            {
                if (ex.Message.Contains("DeepSeek"))
                    return StatusCode(502, new { message = "DeepSeek está con mucho tráfico (429). Probá de nuevo en unos segundos." });
                return StatusCode(502, new { message = "OpenAI está con mucho tráfico (429). Probá de nuevo en unos segundos." });
            }
            if (ex.Message.Contains("DeepSeek"))
                return StatusCode(502, new { message = "No se pudo contactar a DeepSeek. Probá de nuevo más tarde." });
            return StatusCode(502, new { message = "No se pudo contactar a OpenAI. Probá de nuevo más tarde." });
        }
        catch (InvalidOperationException ex) when (ex.Message.StartsWith("429"))
        {
            if (ex.Message.Contains("DeepSeek"))
                return StatusCode(502, new { message = "DeepSeek está con mucho tráfico (429). Probá de nuevo en unos segundos." });
            return StatusCode(502, new { message = "OpenAI está con mucho tráfico (429). Probá de nuevo en unos segundos." });
        }
    }

    [HttpGet("providers")]
    public IActionResult GetProviders()
    {
        if (!TryGetCallerScope(out _, out _))
            return Forbid();
        var current = _assistantService.CurrentProvider;
        var available = _assistantService.AvailableProviders;
        return Ok(new ProvidersResponseDto(current, available));
    }
}
