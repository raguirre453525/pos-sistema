using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using MetraTC.Domain.Entities;
using MetraTC.Domain.Enums;
using MetraTC.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace MetraTC.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;
    private readonly SymmetricSecurityKey _jwtSigningKey;

    public AuthController(ApplicationDbContext context, IConfiguration config, ILogger<AuthController> logger, SymmetricSecurityKey jwtSigningKey)
    {
        _context = context;
        _config = config;
        _logger = logger;
        _jwtSigningKey = jwtSigningKey;
    }

    public record LoginRequest(string Username, string Password);
    public record FeatureFlagsDto(bool ModuloClientes, bool ModuloPromos, bool ModuloReportes, bool PermitirAjusteInflacion);
    public record LoginResponse(Guid Id, string Username, string FullName, string Role, Guid? BusinessId, string BusinessName, string Token, FeatureFlagsDto Features);

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return Unauthorized(new { message = "Usuario y contraseña requeridos" });

        var username = request.Username.Trim();
        var user = await _context.Users
            .Include(u => u.Business)
            .FirstOrDefaultAsync(u => u.Username == username);

        if (user == null)
            return Unauthorized(new { message = "Credenciales inválidas" });

        if (!user.IsActive)
            return Unauthorized(new { message = "Usuario inactivo" });

        var hasher = new PasswordHasher<User>();
        var verify = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verify == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Credenciales inválidas" });

        // If Admin/User, business must exist and be active
        if (user.Role != UserRole.SuperAdmin)
        {
            if (user.BusinessId == null || user.Business == null)
                return Unauthorized(new { message = "Usuario sin negocio asignado" });
            if (!user.Business.IsActive)
                return Unauthorized(new { message = "Negocio inactivo" });
        }

        var token = GenerateJwt(user);

        var features = GetFeatures(user.Business, user.Role);

        var businessName = user.Business?.Name ?? string.Empty;
        var response = new LoginResponse(
            user.Id,
            user.Username,
            user.FullName,
            user.Role.ToString(),
            user.BusinessId,
            businessName,
            token,
            features
        );

        return Ok(response);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { message = "Token inválido" });

        var user = await _context.Users.Include(u => u.Business).FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null || !user.IsActive)
            return Unauthorized(new { message = "Usuario no encontrado" });

        var features = GetFeatures(user.Business, user.Role);

        // Generate fresh token? Return profile without token refresh for now
        return Ok(new
        {
            id = user.Id,
            username = user.Username,
            fullName = user.FullName,
            role = user.Role.ToString(),
            businessId = user.BusinessId,
            businessName = user.Business?.Name,
            features
        });
    }

    private string GenerateJwt(User user)
    {
        var jwtSection = _config.GetSection("Jwt");
        var issuer = jwtSection["Issuer"] ?? "MetraTC";
        var audience = jwtSection["Audience"] ?? "MetraTC";
        var expiryMinutesStr = jwtSection["ExpiryMinutes"];
        var expiryMinutes = 480;
        if (!string.IsNullOrWhiteSpace(expiryMinutesStr) && int.TryParse(expiryMinutesStr, out var parsed))
            expiryMinutes = parsed;

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("businessId", user.BusinessId?.ToString() ?? string.Empty),
            new Claim("businessName", user.Business?.Name ?? string.Empty),
            new Claim("fullName", user.FullName),
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var credentials = new SigningCredentials(_jwtSigningKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static FeatureFlagsDto GetFeatures(Business? business, UserRole role)
    {
        if (business != null)
        {
            return new FeatureFlagsDto(
                business.ModuloClientes,
                business.ModuloPromos,
                business.ModuloReportes,
                business.PermitirAjusteInflacion
            );
        }
        // SuperAdmin without business -> all true per spec
        return new FeatureFlagsDto(true, true, true, true);
    }
}
