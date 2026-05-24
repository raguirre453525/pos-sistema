using MetraTC.Domain.Entities;
using MetraTC.Domain.Interfaces;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MetraTC.Infrastructure.Repositories;

public class InventoryRepository : IInventoryRepository
{
    private readonly ApplicationDbContext _context;

    public InventoryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(Product Product, StockAdjustmentAudit Audit)> AdjustStockAsync(
        Guid productId,
        int delta,
        string reason)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == productId);
        if (product is null)
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {productId}");

        var resultingStock = product.AdjustStock(delta);
        var audit = new StockAdjustmentAudit(product, delta, resultingStock, reason);

        _context.StockAdjustmentAudits.Add(audit);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return (product, audit);
    }
}
