namespace MetraTC.Application.DTOs;

public static class CustomerDtos
{
    public record CreateCustomerDto(string Name, string? Phone, string? Note);
    public record UpdateCustomerDto(string Name, string? Phone, string? Note);

    public record CustomerDto(
        Guid Id,
        string Name,
        string? Phone,
        string? Note,
        bool IsActive,
        decimal Balance,
        DateTime? LastPurchaseAt,
        int? DaysSinceDebt,
        int PendingSalesCount,
        DateTime CreatedAt
    );

    public record CustomerDetailDto(
        CustomerDto Customer,
        List<SaleDtos.SaleDto> PendingSales,
        List<CustomerPaymentDto> Payments,
        List<SaleDtos.SaleDto> AllCreditSales
    );

    public record CustomerPaymentDto(
        Guid Id,
        Guid CustomerId,
        decimal Amount,
        DateTime PaidAt,
        string? Note,
        Guid? SaleId
    );

    public record CreatePaymentDto(decimal Amount, string? Note, Guid? SaleId);
}
