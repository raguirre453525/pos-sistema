using MetraTC.Domain.Entities;
using MetraTC.Domain.Enums;

namespace MetraTC.Domain.Interfaces;

public interface ISalesRepository
{
    Task<Sale> CreateAsync(List<(Guid productId, int quantity)> items, PaymentMethod paymentMethod, Guid? createdBy = null);

    Task<Sale?> GetByIdAsync(Guid id);

    Task<IEnumerable<Sale>> GetAllAsync();
}
