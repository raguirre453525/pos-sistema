using FluentValidation;
using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Validators.Sale;

public class CreateSaleDtoValidator : AbstractValidator<CreateSaleDto>
{
    public CreateSaleDtoValidator()
    {
        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("La venta debe tener al menos un item");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductId)
                .NotEmpty().WithMessage("El ProductId es obligatorio");
            item.RuleFor(i => i.Quantity)
                .GreaterThan(0).WithMessage("La cantidad debe ser mayor a cero");
        });

        RuleFor(x => x.PaymentMethod)
            .IsInEnum().WithMessage("Método de pago inválido");

        RuleFor(x => x).Custom((dto, ctx) =>
        {
            if (dto.IsCredit && (dto.CustomerId == null || dto.CustomerId == Guid.Empty))
                ctx.AddFailure("CustomerId", "Cliente requerido para venta fiada");
        });
    }
}
