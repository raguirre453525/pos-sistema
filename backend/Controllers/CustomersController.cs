using MetraTC.Application.Services;
using Microsoft.AspNetCore.Mvc;
using static MetraTC.Application.DTOs.CustomerDtos;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly ICustomerService _service;
    public CustomersController(ICustomerService service) => _service = service;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerDto dto)
    {
        var result = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id) => Ok(await _service.GetByIdAsync(id));

    [HttpGet("{id}/detail")]
    public async Task<IActionResult> GetDetail(Guid id) => Ok(await _service.GetDetailAsync(id));

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _service.DeleteAsync(id);
        return NoContent();
    }

    [HttpPost("{id}/payments")]
    public async Task<IActionResult> RegisterPayment(Guid id, [FromBody] CreatePaymentDto dto)
    {
        var result = await _service.RegisterPaymentAsync(id, dto);
        return Ok(result);
    }
}
