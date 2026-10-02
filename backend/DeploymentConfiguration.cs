using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace MetraTC.Configuration;

public static class DeploymentConfiguration
{
    private const string DevelopmentJwtKey = "METRATC_SUPER_SECRET_KEY_REPLACE_IN_PROD_32_CHARS_MIN_64_XYZ!";

    public static SymmetricSecurityKey GetJwtSigningKey(IConfiguration configuration, bool isDevelopment)
    {
        var key = configuration["Jwt:Key"];
        if (isDevelopment && string.IsNullOrEmpty(key))
            key = DevelopmentJwtKey;

        if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32 ||
            (!isDevelopment && key.Trim() == DevelopmentJwtKey))
            throw new InvalidOperationException("Jwt:Key must contain at least 32 UTF-8 bytes and must not use the public development key outside Development.");

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }

    public static string[] GetCorsOrigins(IConfiguration configuration, bool isDevelopment)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (origins.Length == 0 && isDevelopment)
            return ["http://localhost:3000"];

        if (origins.Length == 0 || origins.Any(origin =>
            string.IsNullOrWhiteSpace(origin) || origin.Contains('*') ||
            !Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.Equals(origin, uri.GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase) ||
            (!isDevelopment && (uri.Scheme != Uri.UriSchemeHttps || uri.IsLoopback))))
            throw new InvalidOperationException("Cors:AllowedOrigins must contain exact origins without wildcards, paths, or credentials; non-Development origins must use HTTPS and must not be loopback addresses.");

        return origins;
    }
}
