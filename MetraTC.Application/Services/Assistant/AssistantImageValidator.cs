namespace MetraTC.Application.Services.Assistant;

public sealed record AssistantImage(string ContentType, string DataUrl);

public static class AssistantImageValidator
{
    public const int MaxImageCount = 4;
    public const int MaxImageBytes = 5 * 1024 * 1024;
    public const int MaxTotalImageBytes = 10 * 1024 * 1024;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp"
    };

    public static bool TryParse(IReadOnlyList<string>? dataUrls, out List<AssistantImage> images, out string? error)
    {
        images = [];
        error = null;

        if (dataUrls == null || dataUrls.Count == 0) return true;
        if (dataUrls.Count > MaxImageCount)
        {
            error = $"Se permiten hasta {MaxImageCount} imágenes por mensaje.";
            return false;
        }

        long totalBytes = 0;
        foreach (var dataUrl in dataUrls)
        {
            if (string.IsNullOrWhiteSpace(dataUrl))
            {
                error = "Una imagen adjunta está vacía.";
                return false;
            }

            var comma = dataUrl.IndexOf(',');
            if (comma < 0)
            {
                error = "El formato de una imagen adjunta no es válido.";
                return false;
            }

            var header = dataUrl[..comma];
            if (!header.StartsWith("data:", StringComparison.OrdinalIgnoreCase) ||
                !header.EndsWith(";base64", StringComparison.OrdinalIgnoreCase))
            {
                error = "Las imágenes deben enviarse en formato Base64.";
                return false;
            }

            var contentType = header[5..^7].ToLowerInvariant();
            if (!AllowedContentTypes.Contains(contentType))
            {
                error = "Formato no compatible. Adjunta imágenes JPEG, PNG, GIF o WebP.";
                return false;
            }

            var encoded = dataUrl[(comma + 1)..];
            var maxEncodedLength = ((MaxImageBytes + 2) / 3) * 4;
            if (encoded.Length == 0 || encoded.Length > maxEncodedLength || encoded.Length % 4 != 0 || encoded.Any(char.IsWhiteSpace))
            {
                error = $"Cada imagen debe pesar hasta {MaxImageBytes / (1024 * 1024)} MB y contener datos válidos.";
                return false;
            }

            var padding = encoded.EndsWith("==", StringComparison.Ordinal) ? 2 : encoded.EndsWith("=", StringComparison.Ordinal) ? 1 : 0;
            var imageBytes = (long)(encoded.Length / 4) * 3 - padding;
            if (imageBytes <= 0 || imageBytes > MaxImageBytes)
            {
                error = $"Cada imagen debe pesar hasta {MaxImageBytes / (1024 * 1024)} MB.";
                return false;
            }

            totalBytes += imageBytes;
            if (totalBytes > MaxTotalImageBytes)
            {
                error = $"El total de imágenes no puede superar {MaxTotalImageBytes / (1024 * 1024)} MB.";
                return false;
            }

            try
            {
                if (Convert.FromBase64String(encoded).LongLength != imageBytes)
                    throw new FormatException();
            }
            catch (FormatException)
            {
                error = "Una imagen adjunta contiene datos Base64 no válidos.";
                return false;
            }

            images.Add(new AssistantImage(contentType, dataUrl));
        }

        return true;
    }
}
