using FluentValidation;
using static MetraTC.Application.DTOs.SaleDtos;

namespace MetraTC.Application.Validators.Sale;

public class CreateSaleDtoValidator : AbstractValidator<CreateSaleDto>
{
    public CreateSaleDtoValidator()
    {
        RuleFor(x => x).Custom((dto, ctx) =>
        {
            var hasItems = dto.Items != null && dto.Items.Count > 0;
            var hasCombos = dto.Combos != null && dto.Combos.Count > 0;
            if (!hasItems && !hasCombos) ctx.AddFailure("Items", "La venta debe tener al menos un item o combo");
        });
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductId)
                .NotEmpty().WithMessage("El ProductId es obligatorio");
            item.RuleFor(i => i.Quantity)
                .GreaterThan(0).WithMessage("La cantidad debe ser mayor a cero")
                .Must(q => decimal.Round(q, 3) == q).WithMessage("La cantidad no puede tener más de 3 decimales");
        });
        RuleForEach(x => x.Combos).ChildRules(c =>
        {
            c.RuleFor(i => i.PromotionId).NotEmpty().WithMessage("PromotionId requerido");
            c.RuleFor(i => i.Quantity).InclusiveBetween(1, 99).WithMessage("Cantidad combo 1..99");
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
