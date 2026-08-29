using MetraTC.Application.Services;
using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    public ProductsController(IProductService productService, ICategoryService categoryService, IProductPriceHistoryService priceHistoryService, IWebHostEnvironment env, ApplicationDbContext context)
    {
        _productService = productService;
        _categoryService = categoryService;
        _priceHistoryService = priceHistoryService;
        _env = env;
        _context = context;
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
        if (file == null || file.Length == 0) return BadRequest("Archivo requerido");
        if (file.Length > 5 * 1024 * 1024) return BadRequest("Máximo 5MB");
        if (file.ContentType == null || !file.ContentType.StartsWith("image/")) return BadRequest("Solo imágenes");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        if (!allowed.Contains(ext)) return BadRequest("Extensión no permitida (jpg, jpeg, png, webp)");

        var product = await _context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id);
        if (product == null) return NotFound($"No se encontró producto con ID: {id}");

        var webRoot = _env.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot) || !Directory.Exists(webRoot))
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var dir = Path.Combine(webRoot, "images", "products");
        Directory.CreateDirectory(dir);
        var fileName = $"{id}{ext}";
        var fullPath = Path.Combine(dir, fileName);
        using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }
        var url = $"/images/products/{fileName}";
        product.SetImageUrl(url);
        await _context.SaveChangesAsync();
        return Ok(new { imageUrl = url });
    }

    [HttpPost("image-upload")]
    public async Task<IActionResult> UploadImageTemp(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("Archivo requerido");
        if (file.Length > 5 * 1024 * 1024) return BadRequest("Máximo 5MB");
        if (file.ContentType == null || !file.ContentType.StartsWith("image/")) return BadRequest("Solo imágenes");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        if (!allowed.Contains(ext)) return BadRequest("Extensión no permitida");
        var webRoot = _env.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot) || !Directory.Exists(webRoot))
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var dir = Path.Combine(webRoot, "images", "products");
        Directory.CreateDirectory(dir);
        var tempId = Guid.NewGuid();
        var fileName = $"{tempId}{ext}";
        var fullPath = Path.Combine(dir, fileName);
        using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }
        var url = $"/images/products/{fileName}";
        return Ok(new { imageUrl = url });
    }
}
