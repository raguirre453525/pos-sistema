using AutoMapper;
using MetraTC.Domain.Interfaces;
using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Services;

public class SalesService : ISalesService
{
    private readonly ISalesRepository _repository;
    private readonly IMapper _mapper;

    public SalesService(ISalesRepository repository, IMapper mapper)
    {
        _repository = repository;
        _mapper = mapper;
    }

    public async Task<SaleDto> CreateAsync(CreateSaleDto dto, Guid businessId)
    {
        if (dto.IsCredit && (dto.CustomerId == null || dto.CustomerId == Guid.Empty))
            throw new ArgumentException("Cliente requerido para venta fiada", nameof(dto.CustomerId));

        DateTime? dueDate = null;
        if (dto.IsCredit)
        {
            if (dto.DueDate.HasValue)
            {
                dueDate = dto.DueDate.Value;
                var days = (dueDate.Value.Date - DateTime.UtcNow.Date).TotalDays;
                // Validate range 1..365 days from now (inclusive)
                if (days < 1 || days > 365)
                    throw new ArgumentException("Plazo debe ser entre 1 y 365 días", nameof(dto.DueDate));
            }
            else if (dto.DueDays.HasValue)
            {
                if (dto.DueDays.Value < 1 || dto.DueDays.Value > 365)
                    throw new ArgumentException("Plazo debe ser entre 1 y 365 días", nameof(dto.DueDays));
                dueDate = DateTime.UtcNow.Date.AddDays(dto.DueDays.Value);
            }
            else
            {
                // default 14 days as per frontend spec
                dueDate = DateTime.UtcNow.Date.AddDays(14);
            }
        }

        var items = dto.Items.Select(i => (i.ProductId, i.Quantity)).ToList();
        var combos = dto.Combos?.Select(c => (c.PromotionId, c.Quantity)).ToList();
        var sale = await _repository.CreateAsync(businessId, items, dto.PaymentMethod, null, dto.CustomerId, dto.IsCredit, dueDate, combos);

        return _mapper.Map<SaleDto>(sale);
    }

    public async Task<SaleDto> GetByIdAsync(Guid id, Guid businessId)
    {
        var sale = await _repository.GetByIdAsync(id, businessId);
        if (sale == null)
            throw new KeyNotFoundException($"No se encontró ninguna venta con el ID: {id}");

        return _mapper.Map<SaleDto>(sale);
    }

    public async Task<IEnumerable<SaleDto>> GetAllAsync(Guid businessId)
    {
        var sales = await _repository.GetAllAsync(businessId);
        return _mapper.Map<IEnumerable<SaleDto>>(sales);
    }
}
