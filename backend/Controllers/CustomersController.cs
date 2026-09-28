using System.Security.Claims;
using MetraTC.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static MetraTC.Application.DTOs.CustomerDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly ICustomerService _service;
    public CustomersController(ICustomerService service) => _service = service;

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
    public async Task<IActionResult> Create([FromBody] CreateCustomerDto dto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede operar clientes" });
        var result = await _service.CreateAsync(dto, businessId);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar clientes" });
        return Ok(await _service.GetAllAsync(businessId));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar clientes" });
        return Ok(await _service.GetByIdAsync(id, businessId));
    }

    [HttpGet("{id}/detail")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "El SuperAdmin no puede operar clientes" });
        return Ok(await _service.GetDetailAsync(id, businessId));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerDto dto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede modificar clientes" });
        var result = await _service.UpdateAsync(id, dto, businessId);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede eliminar clientes" });
        await _service.DeleteAsync(id, businessId);
        return NoContent();
    }

    [HttpPost("{id}/payments")]
    public async Task<IActionResult> RegisterPayment(Guid id, [FromBody] CreatePaymentDto dto)
    {
        if (!TryGetBusinessId(out var businessId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "SuperAdmin no puede operar clientes" });
        var result = await _service.RegisterPaymentAsync(id, dto, businessId);
        return Ok(result);
    }
}
