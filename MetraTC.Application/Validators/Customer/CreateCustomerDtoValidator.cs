using FluentValidation;
using static MetraTC.Application.DTOs.CustomerDtos;

namespace MetraTC.Application.Validators.Customer;

public class CreateCustomerDtoValidator : AbstractValidator<CreateCustomerDto>
{
    public CreateCustomerDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("El nombre es obligatorio").Length(2, 100).WithMessage("El nombre debe tener entre 2 y 100 caracteres");
        RuleFor(x => x.Phone).MaximumLength(30).WithMessage("El teléfono no puede exceder 30 caracteres");
        RuleFor(x => x.Note).MaximumLength(500).WithMessage("La nota no puede exceder 500 caracteres");
    }
}

public class UpdateCustomerDtoValidator : AbstractValidator<UpdateCustomerDto>
{
    public UpdateCustomerDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("El nombre es obligatorio").Length(2, 100).WithMessage("El nombre debe tener entre 2 y 100 caracteres");
        RuleFor(x => x.Phone).MaximumLength(30).WithMessage("El teléfono no puede exceder 30 caracteres");
        RuleFor(x => x.Note).MaximumLength(500).WithMessage("La nota no puede exceder 500 caracteres");
    }
}

public class CreatePaymentDtoValidator : AbstractValidator<CreatePaymentDto>
{
    public CreatePaymentDtoValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("El monto debe ser mayor a 0");
        RuleFor(x => x.Note).MaximumLength(500).WithMessage("La nota no puede exceder 500 caracteres");
    }
}
