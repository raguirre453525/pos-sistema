using System.Security.Claims;
using MetraTC.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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

    private bool TryGetBusinessId(out Guid businessId)
    {
        businessId = Guid.Empty;
        var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase)) return false;
        var businessIdClaim = User.FindFirstValue("businessId") ?? User.FindFirst("businessId")?.Value;
        if (string.IsNullOrWhiteSpace(businessIdClaim)) return false;
        return Guid.TryParse(businessIdClaim, out businessId) && businessId != Guid.Empty;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateSaleDto dto)
    {
        if (!TryGetBusinessId(out var businessId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        }

        var sale = await _salesService.CreateAsync(dto, businessId);
        return CreatedAtAction(nameof(GetById), new { id = sale.Id }, sale);
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var sale = await _salesService.GetByIdAsync(id, businessId);
        return Ok(sale);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar caja" });
        var sales = await _salesService.GetAllAsync(businessId);
        return Ok(sales);
    }
}
