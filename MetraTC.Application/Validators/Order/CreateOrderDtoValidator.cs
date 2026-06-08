using FluentValidation;
using static MetraTC.Application.DTOs.OrderDtos;

namespace MetraTC.Application.Validators.Order;

public class CreateOrderItemDtoValidator : AbstractValidator<CreateOrderItemDto>
{
    public CreateOrderItemDtoValidator()
    {
        RuleFor(x => x.ProductId)
            .NotEmpty().WithMessage("El ID del producto es obligatorio");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("La cantidad debe ser mayor a cero");
    }
}

public class CreateOrderDtoValidator : AbstractValidator<CreateOrderDto>
{
    public CreateOrderDtoValidator()
    {
        RuleFor(x => x.OrderNumber)
            .NotEmpty().WithMessage("El número de orden es obligatorio");

        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("La orden debe contener al menos un producto");

        // Esta línea es mágica: le dice que valide cada ítem de la lista usando las reglas de arriba
        RuleForEach(x => x.Items).SetValidator(new CreateOrderItemDtoValidator());
    }
}