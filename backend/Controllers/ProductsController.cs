using MetraTC.Application.Services;
using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly ICategoryService _categoryService;
    private readonly IProductPriceHistoryService _priceHistoryService;
    private readonly IWebHostEnvironment _env;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(IProductService productService, ICategoryService categoryService, IProductPriceHistoryService priceHistoryService, IWebHostEnvironment env, ApplicationDbContext context, ILogger<ProductsController> logger)
    {
        _productService = productService;
        _categoryService = categoryService;
        _priceHistoryService = priceHistoryService;
        _env = env;
        _context = context;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductDto createProductDto)
    {
        var productDto = await _productService.CreateAsync(createProductDto);

        return Ok(productDto);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var productsDto = await _productService.GetAllAsync();

        return Ok(productsDto);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var productDto = await _productService.GetByIdAsync(id);

        return Ok(productDto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductDto updateProductDto)
    {
        await _productService.UpdateAsync(id, updateProductDto);

        return NoContent();
    }

    [HttpPost("{id}/stock-adjustments")]
    public async Task<IActionResult> AdjustStock(Guid id, [FromBody] StockAdjustmentDto stockAdjustmentDto)
    {
        var response = await _productService.AdjustStockAsync(id, stockAdjustmentDto);

        return Ok(response);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _productService.DeleteAsync(id);

        return NoContent();
    }

    [HttpPost("{productId:guid}/categories/{categoryId:guid}")]
    public async Task<IActionResult> AssignCategory(Guid productId, Guid categoryId)
    {
        await _categoryService.AssignProductAsync(categoryId, productId);
        return NoContent();
    }

    [HttpDelete("{productId:guid}/categories/{categoryId:guid}")]
    public async Task<IActionResult> UnassignCategory(Guid productId, Guid categoryId)
    {
        await _categoryService.UnassignProductAsync(categoryId, productId);
        return NoContent();
    }

    [HttpGet("{id:guid}/price-history")]
    public async Task<IActionResult> GetPriceHistory(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _priceHistoryService.GetPriceHistoryAsync(id, from, to, page, pageSize);
        return Ok(result);
    }

    [HttpPost("bulk-price-adjustment")]
    public async Task<IActionResult> BulkAdjust([FromBody] BulkPriceAdjustmentDto dto)
    {
        var result = await _productService.BulkAdjustPricesAsync(dto);
        return Ok(result);
    }

    [HttpPost("{id}/image")]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        // FIX: crash al editar producto y cambiar imagen - causas probables: DirectoryNotFound cuando wwwroot no existe,
        // NullReference si file==null, y excepción no controlada por FileStream sin await using / sin CreateDirectory del parent.
        // Diagnóstico temporal deja traza en terminal; hardening evita cierre de back/front.
        try
        {
            Console.WriteLine($"[Upload] Product {id} file {file?.FileName} {file?.Length}");
            if (file == null || file.Length == 0) return BadRequest(new { message = "Archivo requerido" });
            if (file.Length > 5 * 1024 * 1024) return BadRequest(new { message = "Archivo muy grande (máximo 5MB)" });
            if (file.ContentType == null || !file.ContentType.StartsWith("image/")) return BadRequest(new { message = "Formato no soportado (solo imágenes)" });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            if (!allowed.Contains(ext)) return BadRequest(new { message = "Extensión no permitida (jpg, jpeg, png, webp)" });

            var product = await _context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id);
            if (product == null) return NotFound(new { message = $"No se encontró producto con ID: {id}" });

            var webRoot = _env.WebRootPath;
            if (string.IsNullOrWhiteSpace(webRoot) || !Directory.Exists(webRoot))
                webRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
            var dir = Path.Combine(webRoot, "images", "products");
            Directory.CreateDirectory(dir);
            var fileName = $"{id}{ext}";
            var fullPath = Path.Combine(dir, fileName);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await using var fs = new FileStream(fullPath, FileMode.Create);
            await file.CopyToAsync(fs);
            var url = $"/images/products/{fileName}";
            product.SetImageUrl(url);
            await _context.SaveChangesAsync();
            return Ok(new { imageUrl = url });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Upload] Error al subir imagen producto {Id} file {FileName}", id, file?.FileName);
            Console.WriteLine($"[Upload][Error] Product {id} {ex.GetType().Name}: {ex.Message}");
            return StatusCode(500, new { message = "Error interno al subir imagen" });
        }
    }

    [HttpPost("image-upload")]
    public async Task<IActionResult> UploadImageTemp(IFormFile file)
    {
        try
        {
            Console.WriteLine($"[UploadTemp] file {file?.FileName} {file?.Length}");
            if (file == null || file.Length == 0) return BadRequest(new { message = "Archivo requerido" });
            if (file.Length > 5 * 1024 * 1024) return BadRequest(new { message = "Archivo muy grande (máximo 5MB)" });
            if (file.ContentType == null || !file.ContentType.StartsWith("image/")) return BadRequest(new { message = "Formato no soportado (solo imágenes)" });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            if (!allowed.Contains(ext)) return BadRequest(new { message = "Extensión no permitida" });
            var webRoot = _env.WebRootPath;
            if (string.IsNullOrWhiteSpace(webRoot) || !Directory.Exists(webRoot))
                webRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
            var dir = Path.Combine(webRoot, "images", "products");
            Directory.CreateDirectory(dir);
            var tempId = Guid.NewGuid();
            var fileName = $"{tempId}{ext}";
            var fullPath = Path.Combine(dir, fileName);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await using var fs = new FileStream(fullPath, FileMode.Create);
            await file.CopyToAsync(fs);
            var url = $"/images/products/{fileName}";
            return Ok(new { imageUrl = url });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[UploadTemp] Error al subir imagen temporal {FileName}", file?.FileName);
            Console.WriteLine($"[UploadTemp][Error] {ex.GetType().Name}: {ex.Message}");
            return StatusCode(500, new { message = "Error interno al subir imagen" });
        }
    }
}
