using MetraTC.Domain.Entities;
using MetraTC.Domain.Enums;

namespace MetraTC.Domain.Interfaces;

public interface ISalesRepository
{
    Task<Sale> CreateAsync(List<(Guid productId, decimal quantity)> items, PaymentMethod paymentMethod, Guid? createdBy = null, Guid? customerId = null, bool isCredit = false, DateTime? dueDate = null, List<(Guid promotionId, int quantity)>? combos = null);

    Task<Sale?> GetByIdAsync(Guid id);

    Task<IEnumerable<Sale>> GetAllAsync();
}
