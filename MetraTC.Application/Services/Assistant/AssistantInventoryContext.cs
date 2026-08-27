using System.Text;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MetraTC.Application.Services.Assistant;

public class AssistantInventoryContext
{
    private readonly ApplicationDbContext _db;

    public AssistantInventoryContext(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<string> GetInventoryContextAsync(CancellationToken ct)
    {
        var totalActive = await _db.Products.CountAsync(p => p.IsActive, ct);

        if (totalActive == 0)
            return "Inventario vacío.";

        var lowStockCount = await _db.Products.CountAsync(p => p.IsActive && p.Stock <= 5, ct);

        var items = await _db.Products
            .Where(p => p.IsActive)
            .OrderBy(p => p.Stock)
            .ThenBy(p => p.Name)
            .Take(50)
            .Select(p => new
            {
                p.Name,
                p.Stock,
                p.Price,
                Categories = p.Categories.Select(c => c.Name).ToList()
            })
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine($"Inventario actual ({items.Count} productos, orden por stock bajo):");

        foreach (var item in items)
        {
            var category = item.Categories.Count > 0
                ? string.Join(", ", item.Categories)
                : "Sin categoría";
            var priceFormatted = item.Price.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
            sb.AppendLine($"- {item.Name} | stock: {item.Stock} | precio: ${priceFormatted} | categoría: {category}");
        }

        sb.Append($"Total productos activos: {totalActive}. Productos con stock <=5: {lowStockCount}");

        return sb.ToString();
    }
}
