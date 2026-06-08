using AutoMapper;
using MetraTC.Domain.Entities;
using MetraTC.Domain.Interfaces; // Asumiendo que tienes IRepository<T> igual que el sistema médico
using System.Numerics;
using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public class ProductService : IProductService
{
    private readonly IRepository<Product> _productRepository;
    private readonly IMapper _mapper;

    public ProductService(IRepository<Product> productRepository, IMapper mapper)
    {
        _productRepository = productRepository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<ProductDto>> CreateAsync(IEnumerable<CreateProductDto> createProductDtos)
    {
        var createdProducts = new List<Product>();

        foreach (var dto in createProductDtos)
        {
            // La entidad valida sus propios datos en el constructor
            var product = new Product(dto.Sku, dto.Name, dto.Price, dto.Stock, dto.Barcode, dto.Description);

            await _productRepository.AddAsync(product);
            createdProducts.Add(product);
        }

        return _mapper.Map<IEnumerable<ProductDto>>(createdProducts);
    }

    public async Task<IEnumerable<ProductDto>> GetAllAsync()
    {
        var products = await _productRepository.GetAllAsync();

        return _mapper.Map<IEnumerable<ProductDto>>(products);
    }

    public async Task<ProductDto> GetByIdAsync(Guid id)
    {
        var product = await GetProductOrThrowAsync(id);

        return _mapper.Map<ProductDto>(product);
    }

    public async Task UpdateAsync(Guid id, UpdateProductDto updateProductDto)
    {
        var product = await GetProductOrThrowAsync(id);

        product.Update(updateProductDto.Name, updateProductDto.Price, updateProductDto.Stock, updateProductDto.Description);

        await _productRepository.UpdateAsync(product);
    }

    public async Task DeleteAsync(Guid id)
    {
        var product = await GetProductOrThrowAsync(id);

        product.Deactivate();

        await _productRepository.UpdateAsync(product);
    }

    private async Task<Product> GetProductOrThrowAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id);

        if (product == null)
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {id}");

        return product;
    }
}