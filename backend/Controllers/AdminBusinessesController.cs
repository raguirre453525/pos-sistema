using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/admin/businesses")]
[Authorize(Roles = "SuperAdmin")]
public class AdminBusinessesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminBusinessesController(ApplicationDbContext context)
    {
        _context = context;
    }

    public record BusinessDto(Guid Id, string Name, string? Cuit, bool IsActive, bool ModuloClientes, bool ModuloPromos, bool ModuloReportes, bool PermitirAjusteInflacion, int UsersCount, DateTime CreatedAt);
    public record UpdateFeaturesDto(bool ModuloClientes, bool ModuloPromos, bool ModuloReportes, bool PermitirAjusteInflacion);
    public record CreateBusinessDto(string Name, string? Cuit, bool? IsActive);
    public record ToggleStatusDto(bool? IsActive);

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var businesses = await _context.Businesses
            .Include(b => b.Users)
            .OrderBy(b => b.Name)
            .Select(b => new BusinessDto(
                b.Id,
                b.Name,
                b.Cuit,
                b.IsActive,
                b.ModuloClientes,
                b.ModuloPromos,
                b.ModuloReportes,
                b.PermitirAjusteInflacion,
                b.Users.Count,
                b.CreatedAt
            ))
            .ToListAsync();

        return Ok(businesses);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var business = await _context.Businesses
            .Include(b => b.Users)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (business == null)
            return NotFound(new { message = $"No se encontró negocio con ID: {id}" });

        var dto = new BusinessDto(
            business.Id,
            business.Name,
            business.Cuit,
            business.IsActive,
            business.ModuloClientes,
            business.ModuloPromos,
            business.ModuloReportes,
            business.PermitirAjusteInflacion,
            business.Users.Count,
            business.CreatedAt
        );

        return Ok(dto);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBusinessDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "El nombre es obligatorio" });
        if (dto.Name.Trim().Length > 150)
            return BadRequest(new { message = "El nombre no puede exceder 150 caracteres" });
        if (dto.Cuit != null && dto.Cuit.Trim().Length > 20)
            return BadRequest(new { message = "El CUIT no puede exceder 20 caracteres" });

        var name = dto.Name.Trim();
        var exists = await _context.Businesses.AnyAsync(b => b.Name == name);
        if (exists)
            return Conflict(new { message = $"Ya existe un negocio con nombre '{name}'" });

        var business = new MetraTC.Domain.Entities.Business
        {
            Id = Guid.NewGuid(),
            Name = name,
            Cuit = string.IsNullOrWhiteSpace(dto.Cuit) ? null : dto.Cuit.Trim(),
            IsActive = dto.IsActive ?? true,
            ModuloClientes = true,
            ModuloPromos = true,
            ModuloReportes = true,
            PermitirAjusteInflacion = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Businesses.Add(business);
        await _context.SaveChangesAsync();

        var result = new BusinessDto(
            business.Id,
            business.Name,
            business.Cuit,
            business.IsActive,
            business.ModuloClientes,
            business.ModuloPromos,
            business.ModuloReportes,
            business.PermitirAjusteInflacion,
            0,
            business.CreatedAt
        );

        return CreatedAtAction(nameof(GetById), new { id = business.Id }, result);
    }

    [HttpPatch("{id:guid}/toggle")]
    [HttpPut("{id:guid}/status")]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> ToggleStatus(Guid id, [FromBody] ToggleStatusDto? dto)
    {
        var business = await _context.Businesses.FirstOrDefaultAsync(b => b.Id == id);
        if (business == null)
            return NotFound(new { message = $"No se encontró negocio con ID: {id}" });

        // If body provides IsActive use it, otherwise toggle
        if (dto?.IsActive.HasValue == true)
            business.IsActive = dto.IsActive.Value;
        else
            business.IsActive = !business.IsActive;

        await _context.SaveChangesAsync();

        var result = new BusinessDto(
            business.Id,
            business.Name,
            business.Cuit,
            business.IsActive,
            business.ModuloClientes,
            business.ModuloPromos,
            business.ModuloReportes,
            business.PermitirAjusteInflacion,
            await _context.Users.CountAsync(u => u.BusinessId == business.Id),
            business.CreatedAt
        );

        return Ok(result);
    }

    [HttpPut("{id:guid}/features")]
    public async Task<IActionResult> UpdateFeatures(Guid id, [FromBody] UpdateFeaturesDto dto)
    {
        var business = await _context.Businesses.FirstOrDefaultAsync(b => b.Id == id);
        if (business == null)
            return NotFound(new { message = $"No se encontró negocio con ID: {id}" });

        business.ModuloClientes = dto.ModuloClientes;
        business.ModuloPromos = dto.ModuloPromos;
        business.ModuloReportes = dto.ModuloReportes;
        business.PermitirAjusteInflacion = dto.PermitirAjusteInflacion;

        await _context.SaveChangesAsync();

        var result = new BusinessDto(
            business.Id,
            business.Name,
            business.Cuit,
            business.IsActive,
            business.ModuloClientes,
            business.ModuloPromos,
            business.ModuloReportes,
            business.PermitirAjusteInflacion,
            await _context.Users.CountAsync(u => u.BusinessId == business.Id),
            business.CreatedAt
        );

        return Ok(result);
    }
}
