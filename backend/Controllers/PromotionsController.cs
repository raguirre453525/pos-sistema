using MetraTC.Application.Services;
using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static MetraTC.Application.DTOs.PromotionDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PromotionsController : ControllerBase
{
    private readonly IPromotionService _service;
    private readonly IWebHostEnvironment _env;
    private readonly ApplicationDbContext _context;
    public PromotionsController(IPromotionService service, IWebHostEnvironment env, ApplicationDbContext context)
    {
        _service = service;
        _env = env;
        _context = context;
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
        if (file == null || file.Length == 0) return BadRequest("Archivo requerido");
        if (file.Length > 5 * 1024 * 1024) return BadRequest("Máximo 5MB");
        if (file.ContentType == null || !file.ContentType.StartsWith("image/")) return BadRequest("Solo imágenes");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        if (!allowed.Contains(ext)) return BadRequest("Extensión no permitida (jpg, jpeg, png, webp)");
        var promo = await _context.Promotions.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id);
        if (promo == null) return NotFound($"No se encontró promoción con ID: {id}");
        var webRoot = _env.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot) || !Directory.Exists(webRoot))
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var dir = Path.Combine(webRoot, "images", "promotions");
        Directory.CreateDirectory(dir);
        var fileName = $"{id}{ext}";
        var fullPath = Path.Combine(dir, fileName);
        using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }
        var url = $"/images/promotions/{fileName}";
        promo.SetImageUrl(url);
        await _context.SaveChangesAsync();
        return Ok(new { imageUrl = url });
    }
}
