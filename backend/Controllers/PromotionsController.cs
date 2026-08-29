using MetraTC.Application.Services;
using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static MetraTC.Application.DTOs.PromotionDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
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

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePromotionDto dto)
    {
        var res = await _service.CreateAsync(dto);
        return Ok(res);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpGet("active")]
    public async Task<IActionResult> GetActive() => Ok(await _service.GetActiveAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id) => Ok(await _service.GetByIdAsync(id));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePromotionDto dto)
    {
        var res = await _service.UpdateAsync(id, dto);
        return Ok(res);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _service.DeleteAsync(id);
        return NoContent();
    }

    [HttpPatch("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id) => Ok(await _service.ToggleActiveAsync(id));

    [HttpPost("{id}/image")]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        // FIX: mismo hardening que Products - evita DirectoryNotFound / NullReference y loguea diagnóstico
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
