using AutoMapper;
using MetraTC.Domain.Entities;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static MetraTC.Application.DTOs.CustomerDtos;
using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Services;

public class CustomerService : ICustomerService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public CustomerService(ApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<CustomerDto> CreateAsync(CreateCustomerDto dto, Guid businessId)
    {
        var customer = new Customer(dto.Name, dto.Phone, dto.Note);
        customer.BusinessId = businessId;
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();
        return await ToDtoAsync(customer);
    }

    public async Task<CustomerDto> UpdateAsync(Guid id, UpdateCustomerDto dto, Guid businessId)
    {
        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró cliente con ID: {id}");
        if (!customer.IsActive) throw new KeyNotFoundException($"No se encontró cliente con ID: {id}");
        customer.Update(dto.Name, dto.Phone, dto.Note);
        await _context.SaveChangesAsync();
        return await ToDtoAsync(customer);
    }

    public async Task<IEnumerable<CustomerDto>> GetAllAsync(Guid businessId)
    {
        var customers = await _context.Customers.Where(c => c.BusinessId == businessId).OrderBy(c => c.Name).ToListAsync();
        if (customers.Count == 0) return Enumerable.Empty<CustomerDto>();

        var customerIds = customers.Select(c => c.Id).ToList();

        // Balance correcto = suma de remanentes (Total - PaidAmount) de ventas no saldadas.
        var pendingSales = await _context.Sales
            .Where(s => s.BusinessId == businessId && s.CustomerId != null && s.PaidAmount < s.Total && customerIds.Contains(s.CustomerId!.Value))
            .GroupBy(s => s.CustomerId!.Value)
            .Select(g => new { CustomerId = g.Key, Remaining = g.Sum(x => x.Total - x.PaidAmount), Count = g.Count(), MinDate = g.Min(x => x.Date), MaxDate = g.Max(x => x.Date) })
            .ToListAsync();

        // For LastPurchaseAt we need max date of ANY sale for that customer (not only pending)
        var lastPurchases = await _context.Sales
            .Where(s => s.BusinessId == businessId && s.CustomerId != null && customerIds.Contains(s.CustomerId!.Value))
            .GroupBy(s => s.CustomerId!.Value)
            .Select(g => new { CustomerId = g.Key, Last = g.Max(x => x.Date) })
            .ToListAsync();

        var pendingDict = pendingSales.ToDictionary(x => x.CustomerId);
        var lastDict = lastPurchases.ToDictionary(x => x.CustomerId);

        var result = new List<CustomerDto>();
        foreach (var c in customers)
        {
            pendingDict.TryGetValue(c.Id, out var pend);
            lastDict.TryGetValue(c.Id, out var last);

            var balance = pend?.Remaining ?? 0m;
            if (balance < 0) balance = 0;

            int? daysSinceDebt = null;
            if (pend != null && balance > 0)
            {
                daysSinceDebt = (int)(DateTime.UtcNow - pend.MinDate).TotalDays;
            }

            result.Add(new CustomerDto(
                c.Id,
                c.Name,
                c.Phone,
                c.Note,
                c.IsActive,
                balance,
                last?.Last,
                daysSinceDebt,
                pend?.Count ?? 0,
                c.CreatedAt
            ));
        }
        return result;
    }

    public async Task<CustomerDto> GetByIdAsync(Guid id, Guid businessId)
    {
        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró cliente con ID: {id}");
        return await ToDtoAsync(customer);
    }

    public async Task<CustomerDetailDto> GetDetailAsync(Guid id, Guid businessId)
    {
        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró cliente con ID: {id}");

        var dto = await ToDtoAsync(customer);

        var pendingSales = await _context.Sales
            .Include(s => s.Items).ThenInclude(i => i.Product)
            .Where(s => s.BusinessId == businessId && s.CustomerId == id && s.PaidAmount < s.Total)
            .OrderByDescending(s => s.Date)
            .ToListAsync();

        // Historial completo de compras fiadas: todas donde CustomerId == id
        var allCreditSales = await _context.Sales
            .Include(s => s.Items).ThenInclude(i => i.Product)
            .Where(s => s.BusinessId == businessId && s.CustomerId == id)
            .OrderByDescending(s => s.Date)
            .ToListAsync();

        var payments = await _context.CustomerPayments
            .Where(p => p.CustomerId == id)
            .OrderByDescending(p => p.PaidAt)
            .ToListAsync();

        var saleDtos = _mapper.Map<List<SaleDto>>(pendingSales);
        var allCreditDtos = _mapper.Map<List<SaleDto>>(allCreditSales);
        var paymentDtos = payments.Select(p => new CustomerPaymentDto(p.Id, p.CustomerId, p.Amount, p.PaidAt, p.Note, p.SaleId)).ToList();

        return new CustomerDetailDto(dto, saleDtos, paymentDtos, allCreditDtos);
    }

    public async Task DeleteAsync(Guid id, Guid businessId)
    {
        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró cliente con ID: {id}");
        customer.Deactivate();
        await _context.SaveChangesAsync();
    }

    public async Task<CustomerPaymentDto> RegisterPaymentAsync(Guid customerId, CreatePaymentDto dto, Guid businessId)
    {
        if (dto.Amount <= 0) throw new ArgumentException("El monto debe ser mayor a 0", nameof(dto.Amount));

        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.BusinessId == businessId)
            ?? throw new KeyNotFoundException($"No se encontró cliente con ID: {customerId}");
        if (!customer.IsActive) throw new KeyNotFoundException($"No se encontró cliente con ID: {customerId}");

        // Balance correcto = suma de remanentes; CustomerPayment es solo auditoría, no se resta.
        var balance = await _context.Sales
            .Where(s => s.BusinessId == businessId && s.CustomerId == customerId && s.PaidAmount < s.Total)
            .SumAsync(s => (decimal?)(s.Total - s.PaidAmount)) ?? 0m;
        if (balance < 0) balance = 0;
        if (dto.Amount > balance) throw new ArgumentException($"El monto excede el saldo pendiente (${balance})", nameof(dto.Amount));

        Sale? targetSale = null;
        if (dto.SaleId.HasValue)
        {
            targetSale = await _context.Sales.FirstOrDefaultAsync(s => s.Id == dto.SaleId.Value && s.BusinessId == businessId);
            if (targetSale == null) throw new KeyNotFoundException($"No se encontró venta con ID: {dto.SaleId}");
            if (targetSale.CustomerId != customerId) throw new ArgumentException("La venta no pertenece al cliente", nameof(dto.SaleId));
            var remaining = targetSale.Total - targetSale.PaidAmount;
            if (remaining <= 0) throw new ArgumentException("La venta no está pendiente", nameof(dto.SaleId));
            if (dto.Amount > remaining) throw new ArgumentException($"El monto excede el saldo de la venta (${remaining})", nameof(dto.Amount));
        }

        var payment = new CustomerPayment(customerId, dto.Amount, dto.Note, dto.SaleId);
        _context.CustomerPayments.Add(payment);

        if (targetSale != null)
        {
            targetSale.RegisterPayment(dto.Amount);
        }
        else
        {
            // Auto-apply FIFO a pendientes ordenados por DueDate/CreatedAt.
            var pendingSales = await _context.Sales
                .Where(s => s.BusinessId == businessId && s.CustomerId == customerId && s.PaidAmount < s.Total)
                .OrderBy(s => s.DueDate ?? DateTime.MaxValue).ThenBy(s => s.Date)
                .ToListAsync();
            var remainingAmount = dto.Amount;
            foreach (var sale in pendingSales)
            {
                if (remainingAmount <= 0) break;
                var saleRemaining = sale.Total - sale.PaidAmount;
                var toApply = Math.Min(saleRemaining, remainingAmount);
                sale.RegisterPayment(toApply);
                remainingAmount -= toApply;
            }
        }

        await _context.SaveChangesAsync();
        return new CustomerPaymentDto(payment.Id, payment.CustomerId, payment.Amount, payment.PaidAt, payment.Note, payment.SaleId);
    }

    private async Task<CustomerDto> ToDtoAsync(Customer c)
    {
        var balance = await _context.Sales
            .Where(s => s.CustomerId == c.Id && s.PaidAmount < s.Total)
            .SumAsync(s => (decimal?)(s.Total - s.PaidAmount)) ?? 0m;
        if (balance < 0) balance = 0;
        var pendingCount = await _context.Sales.CountAsync(s => s.CustomerId == c.Id && s.PaidAmount < s.Total);
        var lastPurchase = await _context.Sales.Where(s => s.CustomerId == c.Id).MaxAsync(s => (DateTime?)s.Date);
        var oldestPending = await _context.Sales.Where(s => s.CustomerId == c.Id && s.PaidAmount < s.Total).MinAsync(s => (DateTime?)s.Date);
        int? daysSinceDebt = null;
        if (oldestPending.HasValue && balance > 0)
            daysSinceDebt = (int)(DateTime.UtcNow - oldestPending.Value).TotalDays;

        return new CustomerDto(c.Id, c.Name, c.Phone, c.Note, c.IsActive, balance, lastPurchase, daysSinceDebt, pendingCount, c.CreatedAt);
    }
}
