using System.Security.Claims;
using MetraTC.Application.Services;
using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static MetraTC.Application.DTOs.PromotionDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PromotionsController : ControllerBase
{
    private readonly IPromotionService _service;
    private readonly IWebHostEnvironment _env;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PromotionsController> _logger;
    public PromotionsController(IPromotionService service, IWebHostEnvironment env, ApplicationDbContext context, ILogger<PromotionsController> logger)
    {
        _service = service;
        _env = env;
        _context = context;
        _logger = logger;
    }

    private bool TryGetBusinessId(out Guid businessId)
    {
        businessId = Guid.Empty;
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase)) return false;
        var bid = User.FindFirst("businessId")?.Value;
        if (string.IsNullOrWhiteSpace(bid)) return false;
        return Guid.TryParse(bid, out businessId) && businessId != Guid.Empty;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePromotionDto dto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede crear promociones" });
        var res = await _service.CreateAsync(dto, businessId);
        return Ok(res);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar promociones" });
        return Ok(await _service.GetAllAsync(businessId));
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar promociones" });
        return Ok(await _service.GetActiveAsync(businessId));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar promociones" });
        return Ok(await _service.GetByIdAsync(id, businessId));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePromotionDto dto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede modificar promociones" });
        var res = await _service.UpdateAsync(id, dto, businessId);
        return Ok(res);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede eliminar promociones" });
        await _service.DeleteAsync(id, businessId);
        return NoContent();
    }

    [HttpPatch("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede modificar promociones" });
        return Ok(await _service.ToggleActiveAsync(id, businessId));
    }

    [HttpPost("{id}/image")]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede operar promociones" });
        try
        {
            Console.WriteLine($"[Upload] Promotion {id} file {file?.FileName} {file?.Length}");
            if (file == null || file.Length == 0) return BadRequest(new { message = "Archivo requerido" });
            if (file.Length > 5 * 1024 * 1024) return BadRequest(new { message = "Archivo muy grande (máximo 5MB)" });
            if (file.ContentType == null || !file.ContentType.StartsWith("image/")) return BadRequest(new { message = "Formato no soportado (solo imágenes)" });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            if (!allowed.Contains(ext)) return BadRequest(new { message = "Extensión no permitida (jpg, jpeg, png, webp)" });
            var promo = await _context.Promotions.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id);
            if (promo == null) return NotFound(new { message = $"No se encontró promoción con ID: {id}" });
            if (promo.BusinessId != businessId) return StatusCode(StatusCodes.Status403Forbidden, new { message = "Promoción no pertenece a su negocio" });
            var webRoot = _env.WebRootPath;
            if (string.IsNullOrWhiteSpace(webRoot) || !Directory.Exists(webRoot))
                webRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
            var dir = Path.Combine(webRoot, "images", "promotions");
            Directory.CreateDirectory(dir);
            var fileName = $"{id}{ext}";
            var fullPath = Path.Combine(dir, fileName);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await using var fs = new FileStream(fullPath, FileMode.Create);
            await file.CopyToAsync(fs);
            var url = $"/images/promotions/{fileName}";
            promo.SetImageUrl(url);
            await _context.SaveChangesAsync();
            return Ok(new { imageUrl = url });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Upload] Error al subir imagen promoción {Id} file {FileName}", id, file?.FileName);
            Console.WriteLine($"[Upload][Error] Promotion {id} {ex.GetType().Name}: {ex.Message}");
            return StatusCode(500, new { message = "Error interno al subir imagen" });
        }
    }
}
