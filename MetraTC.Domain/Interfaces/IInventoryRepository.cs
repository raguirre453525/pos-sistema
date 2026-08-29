using MetraTC.Domain.Entities;

namespace MetraTC.Domain.Interfaces;

public interface IInventoryRepository
{
    Task<(Product Product, StockAdjustmentAudit Audit)> AdjustStockAsync(
        Guid productId,
        decimal delta,
        string reason);
}
