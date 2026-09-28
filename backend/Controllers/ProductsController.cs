using System.Security.Claims;
using MetraTC.Application.Services;
using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
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
    public async Task<IActionResult> Create([FromBody] CreateProductDto createProductDto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede crear productos" });
        var productDto = await _productService.CreateAsync(createProductDto, businessId);
        return Ok(productDto);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var productsDto = await _productService.GetAllAsync(businessId);
        return Ok(productsDto);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var productDto = await _productService.GetByIdAsync(id, businessId);
        return Ok(productDto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductDto updateProductDto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        await _productService.UpdateAsync(id, updateProductDto, businessId);
        return NoContent();
    }

    [HttpPost("{id}/stock-adjustments")]
    public async Task<IActionResult> AdjustStock(Guid id, [FromBody] StockAdjustmentDto stockAdjustmentDto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var response = await _productService.AdjustStockAsync(id, stockAdjustmentDto, businessId);
        return Ok(response);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        await _productService.DeleteAsync(id, businessId);
        return NoContent();
    }

    [HttpPost("{productId:guid}/categories/{categoryId:guid}")]
    public async Task<IActionResult> AssignCategory(Guid productId, Guid categoryId)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == productId && p.BusinessId == businessId);
        if (product == null) return NotFound(new { message = $"No se encontró ningún producto con el ID: {productId}" });
        await _categoryService.AssignProductAsync(categoryId, productId);
        return NoContent();
    }

    [HttpDelete("{productId:guid}/categories/{categoryId:guid}")]
    public async Task<IActionResult> UnassignCategory(Guid productId, Guid categoryId)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == productId && p.BusinessId == businessId);
        if (product == null) return NotFound(new { message = $"No se encontró ningún producto con el ID: {productId}" });
        await _categoryService.UnassignProductAsync(categoryId, productId);
        return NoContent();
    }

    [HttpGet("{id:guid}/price-history")]
    public async Task<IActionResult> GetPriceHistory(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id && p.BusinessId == businessId);
        if (product == null) return NotFound(new { message = $"No se encontró ningún producto con el ID: {id}" });
        var result = await _priceHistoryService.GetPriceHistoryAsync(id, from, to, page, pageSize);
        return Ok(result);
    }

    [HttpPost("bulk-price-adjustment")]
    public async Task<IActionResult> BulkAdjust([FromBody] BulkPriceAdjustmentDto dto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var result = await _productService.BulkAdjustPricesAsync(dto, businessId);
        return Ok(result);
    }

    [HttpPost("{id}/image")]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
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
            if (product.BusinessId != businessId) return StatusCode(StatusCodes.Status403Forbidden, new { message = "Producto no pertenece a su negocio" });

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
        // Temp upload does not require product ownership; still requires business context for multi-tenant trace
        if (!TryGetBusinessId(out var _))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
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
