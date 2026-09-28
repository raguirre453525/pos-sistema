using System.Security.Claims;
using MetraTC.Domain.Entities;
using MetraTC.Domain.Enums;
using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public UsersController(ApplicationDbContext context)
    {
        _context = context;
    }

    public record UserDto(Guid Id, string Username, string FullName, string Role, Guid? BusinessId, string? BusinessName, bool IsActive, DateTime CreatedAt);
    public record CreateUserDto(string Username, string Password, string FullName, string Role, Guid? BusinessId);
    public record UpdateUserDto(string? FullName, string? Role, bool? IsActive, Guid? BusinessId);

    private (bool isSuperAdmin, Guid? businessId) GetCallerContext()
    {
        var roleClaim = User.FindFirstValue(ClaimTypes.Role);
        var isSuperAdmin = string.Equals(roleClaim, UserRole.SuperAdmin.ToString(), StringComparison.OrdinalIgnoreCase);
        var businessIdClaim = User.FindFirstValue("businessId");
        Guid? businessId = null;
        if (!string.IsNullOrWhiteSpace(businessIdClaim) && Guid.TryParse(businessIdClaim, out var parsed))
            businessId = parsed;
        return (isSuperAdmin, businessId);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var (isSuperAdmin, callerBusinessId) = GetCallerContext();

        IQueryable<User> query = _context.Users.Include(u => u.Business).AsQueryable();

        if (!isSuperAdmin)
        {
            // Admin: only users of own business
            if (callerBusinessId == null)
                return Forbid();
            query = query.Where(u => u.BusinessId == callerBusinessId);
        }
        // SuperAdmin with businessId null sees all; if SuperAdmin has business context, also all? spec says if SuperAdmin global (no BusinessId) return all. We return all for any SuperAdmin.
        var users = await query
            .OrderBy(u => u.Username)
            .Select(u => new UserDto(
                u.Id,
                u.Username,
                u.FullName,
                u.Role.ToString(),
                u.BusinessId,
                u.Business != null ? u.Business.Name : null,
                u.IsActive,
                u.CreatedAt
            ))
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var (isSuperAdmin, callerBusinessId) = GetCallerContext();

        var user = await _context.Users.Include(u => u.Business).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return NotFound(new { message = $"No se encontró usuario con ID: {id}" });

        if (!isSuperAdmin && user.BusinessId != callerBusinessId)
            return Forbid();

        var dto = new UserDto(user.Id, user.Username, user.FullName, user.Role.ToString(), user.BusinessId, user.Business?.Name, user.IsActive, user.CreatedAt);
        return Ok(dto);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        var (isSuperAdmin, callerBusinessId) = GetCallerContext();

        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password) || string.IsNullOrWhiteSpace(dto.FullName) || string.IsNullOrWhiteSpace(dto.Role))
            return BadRequest(new { message = "Username, Password, FullName y Role son obligatorios" });

        var username = dto.Username.Trim();
        if (username.Length > 50)
            return BadRequest(new { message = "El username no puede exceder 50 caracteres" });
        if (dto.Password.Length < 4 || dto.Password.Length > 100)
            return BadRequest(new { message = "El password debe tener entre 4 y 100 caracteres" });
        if (dto.FullName.Trim().Length > 150 || dto.FullName.Trim().Length < 2)
            return BadRequest(new { message = "El nombre debe tener entre 2 y 150 caracteres" });

        if (!Enum.TryParse<UserRole>(dto.Role, true, out var parsedRole))
            return BadRequest(new { message = $"Rol inválido: {dto.Role}. Valores permitidos: SuperAdmin, Admin, User" });

        Guid? targetBusinessId = dto.BusinessId;

        if (!isSuperAdmin)
        {
            // Admin can only create User or Admin within own business
            if (parsedRole == UserRole.SuperAdmin)
                return BadRequest(new { message = "No autorizado para crear SuperAdmin" });
            if (callerBusinessId == null)
                return BadRequest(new { message = "Admin sin negocio asignado" });
            targetBusinessId = callerBusinessId;
        }
        else
        {
            // SuperAdmin: if role != SuperAdmin, BusinessId required
            if (parsedRole != UserRole.SuperAdmin && targetBusinessId == null)
                return BadRequest(new { message = "BusinessId es requerido para roles Admin/User" });
            if (parsedRole == UserRole.SuperAdmin)
                targetBusinessId = null; // SuperAdmin is global, force null
        }

        if (targetBusinessId != null)
        {
            var businessExists = await _context.Businesses.AnyAsync(b => b.Id == targetBusinessId.Value);
            if (!businessExists)
                return BadRequest(new { message = $"Negocio no encontrado: {targetBusinessId}" });
        }

        var usernameExists = await _context.Users.AnyAsync(u => u.Username == username);
        if (usernameExists)
            return Conflict(new { message = $"Ya existe un usuario con username '{username}'" });

        var hasher = new PasswordHasher<User>();
        // HashPassword requires a user instance for V3; we can pass null? Use empty user
        var dummyUser = new User { Username = username };
        var hash = hasher.HashPassword(dummyUser, dto.Password);

        var user = new User
        {
            Id = Guid.NewGuid(),
            BusinessId = targetBusinessId,
            Username = username,
            PasswordHash = hash,
            FullName = dto.FullName.Trim(),
            Role = parsedRole,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Load business name for response
        string? businessName = null;
        if (user.BusinessId != null)
        {
            var business = await _context.Businesses.FindAsync(user.BusinessId.Value);
            businessName = business?.Name;
        }

        var result = new UserDto(user.Id, user.Username, user.FullName, user.Role.ToString(), user.BusinessId, businessName, user.IsActive, user.CreatedAt);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserDto dto)
    {
        var (isSuperAdmin, callerBusinessId) = GetCallerContext();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return NotFound(new { message = $"No se encontró usuario con ID: {id}" });

        if (!isSuperAdmin && user.BusinessId != callerBusinessId)
            return Forbid();

        if (dto.FullName != null)
        {
            var fullName = dto.FullName.Trim();
            if (fullName.Length < 2 || fullName.Length > 150)
                return BadRequest(new { message = "El nombre debe tener entre 2 y 150 caracteres" });
            user.FullName = fullName;
        }

        if (dto.IsActive.HasValue)
            user.IsActive = dto.IsActive.Value;

        if (dto.Role != null)
        {
            if (!Enum.TryParse<UserRole>(dto.Role, true, out var parsedRole))
                return BadRequest(new { message = $"Rol inválido: {dto.Role}" });
            if (!isSuperAdmin && parsedRole == UserRole.SuperAdmin)
                return BadRequest(new { message = "No autorizado para asignar SuperAdmin" });
            user.Role = parsedRole;
            // If role changed to SuperAdmin, clear BusinessId
            if (parsedRole == UserRole.SuperAdmin)
                user.BusinessId = null;
        }

        if (dto.BusinessId.HasValue)
        {
            if (!isSuperAdmin)
                return BadRequest(new { message = "Admin no puede cambiar BusinessId" });
            if (dto.BusinessId.Value == Guid.Empty)
                user.BusinessId = null;
            else
            {
                var exists = await _context.Businesses.AnyAsync(b => b.Id == dto.BusinessId.Value);
                if (!exists)
                    return BadRequest(new { message = $"Negocio no encontrado: {dto.BusinessId.Value}" });
                user.BusinessId = dto.BusinessId.Value;
            }
        }

        await _context.SaveChangesAsync();

        var businessName = user.BusinessId != null ? (await _context.Businesses.FindAsync(user.BusinessId.Value))?.Name : null;
        return Ok(new UserDto(user.Id, user.Username, user.FullName, user.Role.ToString(), user.BusinessId, businessName, user.IsActive, user.CreatedAt));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var (isSuperAdmin, callerBusinessId) = GetCallerContext();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return NotFound(new { message = $"No se encontró usuario con ID: {id}" });

        if (!isSuperAdmin && user.BusinessId != callerBusinessId)
            return Forbid();

        // Prevent self-deletion? Allow but log
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId != null && Guid.TryParse(currentUserId, out var currentId) && currentId == id)
            return BadRequest(new { message = "No puede eliminarse a sí mismo" });

        // Soft delete via IsActive? Use hard delete? Spec optionally DELETE. We'll soft deactivate to preserve FK integrity.
        user.IsActive = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
