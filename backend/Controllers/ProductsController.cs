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

    public ProductsController(IProductService productService)
    {
        _productService = productService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductDto createProductDto)
    {
        var productDto = await _productService.CreateAsync(createProductDto);

        return Ok(productDto);
    }
}