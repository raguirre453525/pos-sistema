using MetraTC.Application.Services;
using Microsoft.AspNetCore.Mvc;
using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SalesController : ControllerBase
{
    private readonly ISalesService _salesService;

    public SalesController(ISalesService salesService)
    {
        _salesService = salesService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSaleDto dto)
    {
        var sale = await _salesService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = sale.Id }, sale);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var sale = await _salesService.GetByIdAsync(id);
        return Ok(sale);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var sales = await _salesService.GetAllAsync();
        return Ok(sales);
    }
}
