using AutoMapper;
using MetraTC.Application.DTOs;
using MetraTC.Domain.Entities;
using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Mappings;

public class SaleProfile : Profile
{
    public SaleProfile()
    {
        CreateMap<Sale, SaleDto>()
            .ForMember(d => d.PaymentMethod, opt => opt.MapFrom(s => s.PaymentMethod.ToString()))
            .ForMember(d => d.Items, opt => opt.MapFrom(s => s.Items))
            .ForMember(d => d.CreditStatus, opt => opt.MapFrom(s =>
                s.PaidAmount >= s.Total ? "Pagada"
                : s.DueDate.HasValue && s.DueDate.Value < DateTime.UtcNow && s.IsCredit ? "Vencida"
                : s.IsCredit ? "Pendiente"
                : "Pagada"));

        CreateMap<SaleItem, SaleItemDto>()
            .ForMember(d => d.Sku, opt => opt.MapFrom(s => s.Product != null ? s.Product.Sku : string.Empty))
            .ForMember(d => d.Name, opt => opt.MapFrom(s => s.Product != null ? s.Product.Name : string.Empty));
    }
}
