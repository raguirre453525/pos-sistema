using AutoMapper;
using MetraTC.Application.DTOs;
using MetraTC.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Text;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Mappings;

public class ProductProfile : Profile
{
    public ProductProfile()
    {
        CreateMap<Product, ProductDto>();

        CreateMap<CreateProductDto, Product>();
    }
}
