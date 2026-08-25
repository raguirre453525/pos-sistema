using MetraTC.Application.Services;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly ICategoryService _categoryService;

    public ProductsController(IProductService productService, ICategoryService categoryService)
    {
        _productService = productService;
        _categoryService = categoryService;
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
}
