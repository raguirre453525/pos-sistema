using MetraTC.Application.DTOs;
using MetraTC.Application.Services;
using Microsoft.AspNetCore.Mvc;
using static MetraTC.Application.DTOs.CategoryDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;

    public CategoriesController(ICategoryService categoryService)
    {
        _categoryService = categoryService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _categoryService.GetAllAsync();
        return Ok(categories);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var category = await _categoryService.GetByIdAsync(id);
        return Ok(category);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryDto dto)
    {
        var created = await _categoryService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCategoryDto dto)
    {
        var updated = await _categoryService.UpdateAsync(id, dto);
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _categoryService.DeleteAsync(id);
        return NoContent();
    }

    [HttpGet("{id:guid}/products")]
    public async Task<IActionResult> GetProducts(Guid id)
    {
        var products = await _categoryService.GetProductsAsync(id);
        return Ok(products);
    }

    // Many-to-many assignment via categories endpoint (alternative to /api/Products/{productId}/categories/{categoryId})
    [HttpPost("{id:guid}/products/{productId:guid}")]
    public async Task<IActionResult> AssignProduct(Guid id, Guid productId)
    {
        await _categoryService.AssignProductAsync(id, productId);
        return NoContent();
    }

    [HttpDelete("{id:guid}/products/{productId:guid}")]
    public async Task<IActionResult> UnassignProduct(Guid id, Guid productId)
    {
        await _categoryService.UnassignProductAsync(id, productId);
        return NoContent();
    }
}
