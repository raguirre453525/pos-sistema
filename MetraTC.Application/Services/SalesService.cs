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

    public async Task<SaleDto> CreateAsync(CreateSaleDto dto)
    {
        if (dto.IsCredit && (dto.CustomerId == null || dto.CustomerId == Guid.Empty))
            throw new ArgumentException("Cliente requerido para venta fiada", nameof(dto.CustomerId));
        var items = dto.Items.Select(i => (i.ProductId, i.Quantity)).ToList();
        var sale = await _repository.CreateAsync(items, dto.PaymentMethod, null, dto.CustomerId, dto.IsCredit);

        return _mapper.Map<SaleDto>(sale);
    }

    public async Task<SaleDto> GetByIdAsync(Guid id)
    {
        var sale = await _repository.GetByIdAsync(id);
        if (sale == null)
            throw new KeyNotFoundException($"No se encontró ninguna venta con el ID: {id}");

        return _mapper.Map<SaleDto>(sale);
    }

    public async Task<IEnumerable<SaleDto>> GetAllAsync()
    {
        var sales = await _repository.GetAllAsync();
        return _mapper.Map<IEnumerable<SaleDto>>(sales);
    }
}
