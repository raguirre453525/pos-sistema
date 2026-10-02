using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Reflection;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using MetraTC.API.Controllers;
using MetraTC.Application.Services.Assistant;
using MetraTC.Application.Validators.Assistant;
using MetraTC.Configuration;
using MetraTC.Domain.Entities;
using MetraTC.Infrastructure.Persistence;
using MetraTC.Middlewares;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using static MetraTC.Application.DTOs.AssistantDtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

const string imageDataUrl = "data:image/jpeg;base64,/9j/";

if (args is ["--openrouter-live-image", var imagePath])
{
    var liveConfiguration = new ConfigurationBuilder().AddUserSecrets(typeof(AssistantController).Assembly, optional: false).Build();
    Assert(liveConfiguration["Assistant:Provider"] == "openrouter", "The live check requires explicit OpenRouter selection.");
    using var liveClient = new HttpClient();
    var liveExtractor = new AssistantProductExtractor(liveConfiguration, liveClient, NullLogger<AssistantProductExtractor>.Instance);
    var liveImage = new AssistantImage("image/png", "data:image/png;base64," + Convert.ToBase64String(await File.ReadAllBytesAsync(imagePath)));
    var timer = System.Diagnostics.Stopwatch.StartNew();
    try
    {
        var extraction = await liveExtractor.ExtractImageListAsync("", [liveImage], CancellationToken.None);
        var exact = extraction.IsProductList && extraction.Products.Count == 2 &&
            extraction.Products[0].Name == "Olive Oil" && extraction.Products[0].Sku == "00001" &&
            extraction.Products[0].Price == 29.95m && extraction.Products[0].StockDelta == 1.25m &&
            extraction.Products[1].Name == "Rice" && extraction.Products[1].Sku == "00002" &&
            extraction.Products[1].Price == 10.5m && extraction.Products[1].StockDelta == 8m;
        Console.WriteLine(JsonSerializer.Serialize(new { ordinal = 2, completed = true, exactValues = exact, durationMs = timer.ElapsedMilliseconds }));
        Environment.ExitCode = exact ? 0 : 2;
    }
    catch (Exception ex)
    {
        Console.WriteLine(JsonSerializer.Serialize(new { ordinal = 2, completed = false, status = ex.Message == "OpenRouter error 429." ? 429 : (int?)null, errorType = ex.GetType().Name, durationMs = timer.ElapsedMilliseconds }));
        Environment.ExitCode = 2;
    }
    return;
}

var emptyDeploymentConfiguration = new ConfigurationBuilder().Build();
Assert(DeploymentConfiguration.GetCorsOrigins(emptyDeploymentConfiguration, true).SequenceEqual(["http://localhost:3000"]), "Only Development should default to localhost CORS.");
var developmentSigningKey = DeploymentConfiguration.GetJwtSigningKey(emptyDeploymentConfiguration, true);
Assert(developmentSigningKey.KeySize >= 256, "Development startup should retain a valid fallback key.");
foreach (var invalidKey in new[] { null, "", " ", new string('x', 31), Encoding.UTF8.GetString(developmentSigningKey.Key), " " + Encoding.UTF8.GetString(developmentSigningKey.Key) + " " })
{
    var invalidKeyConfiguration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = invalidKey }).Build();
    try
    {
        DeploymentConfiguration.GetJwtSigningKey(invalidKeyConfiguration, false);
        throw new Exception("Non-Development startup must reject missing, short, or public JWT keys.");
    }
    catch (InvalidOperationException) { }
}
foreach (var invalidOrigin in new[] { null, "", "*", "https://*.example.com", "http://shop.example.com", "https://localhost:3000", "https://127.0.0.1", "https://[::1]", "https://shop.example.com/", "https://shop.example.com/path", "https://shop.example.com?query=1", "https://shop.example.com#fragment", "https://user@shop.example.com", " https://shop.example.com" })
{
    var invalidOriginConfiguration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Cors:AllowedOrigins:0"] = invalidOrigin }).Build();
    try
    {
        DeploymentConfiguration.GetCorsOrigins(invalidOriginConfiguration, false);
        throw new Exception("Non-Development startup must reject missing or unsafe CORS origins.");
    }
    catch (InvalidOperationException) { }
}
var deploymentConfiguration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["Cors:AllowedOrigins:0"] = "https://shop.example.com",
    ["Cors:AllowedOrigins:1"] = "https://preview.example.com",
    ["Jwt:Key"] = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
}).Build();
var corsPolicy = new CorsPolicyBuilder(DeploymentConfiguration.GetCorsOrigins(deploymentConfiguration, false)).AllowAnyHeader().AllowAnyMethod().AllowCredentials().Build();
var corsService = new CorsService(Options.Create(new CorsOptions()), NullLoggerFactory.Instance);
foreach (var origin in new[] { "https://shop.example.com", "https://preview.example.com", "http://localhost:3000", "https://attacker.example.com", "https://shop.example.com.attacker.example.com" })
{
    var requestContext = new DefaultHttpContext();
    requestContext.Request.Method = "OPTIONS";
    requestContext.Request.Headers.Origin = origin;
    requestContext.Request.Headers.AccessControlRequestMethod = "POST";
    requestContext.Request.Headers.AccessControlRequestHeaders = "authorization,content-type";
    var result = corsService.EvaluatePolicy(requestContext, corsPolicy);
    var trusted = origin is "https://shop.example.com" or "https://preview.example.com";
    Assert(result.IsOriginAllowed == trusted, "CORS preflights must match only configured exact origins.");
    corsService.ApplyResult(result, requestContext.Response);
    Assert(requestContext.Response.Headers.AccessControlAllowOrigin.ToString() == (trusted ? origin : ""), "Untrusted origins must not receive CORS response headers.");
}
var signingKey = DeploymentConfiguration.GetJwtSigningKey(deploymentConfiguration, false);
var authController = new AuthController(null!, deploymentConfiguration, NullLogger<AuthController>.Instance, signingKey);
deploymentConfiguration["Jwt:Key"] = null;
var tokenUser = new User { Id = Guid.NewGuid(), Username = "deployment-check", FullName = "Deployment Check", BusinessId = Guid.NewGuid() };
var generateJwt = typeof(AuthController).GetMethod("GenerateJwt", BindingFlags.Instance | BindingFlags.NonPublic)!;
var issuedToken = (string)generateJwt.Invoke(authController, [tokenUser])!;
var validationParameters = new TokenValidationParameters
{
    ValidateIssuer = true,
    ValidateAudience = true,
    ValidateLifetime = true,
    ValidateIssuerSigningKey = true,
    ValidIssuer = "MetraTC",
    ValidAudience = "MetraTC",
    IssuerSigningKey = signingKey,
    ClockSkew = TimeSpan.Zero
};
var tokenHandler = new JwtSecurityTokenHandler();
var principal = tokenHandler.ValidateToken(issuedToken, validationParameters, out _);
Assert(principal.FindFirst("businessId")?.Value == tokenUser.BusinessId.ToString(), "Actual AuthController tokens must validate with the startup key even if configuration changes.");
validationParameters.IssuerSigningKey = developmentSigningKey;
try
{
    tokenHandler.ValidateToken(issuedToken, validationParameters, out _);
    throw new Exception("The public development key must not validate production tokens.");
}
catch (SecurityTokenException) { }
var developmentAuth = new AuthController(null!, emptyDeploymentConfiguration, NullLogger<AuthController>.Instance, developmentSigningKey);
validationParameters.IssuerSigningKey = developmentSigningKey;
tokenHandler.ValidateToken((string)generateJwt.Invoke(developmentAuth, [tokenUser])!, validationParameters, out _);
using (var migrationContext = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer("Server=unused;Database=unused").Options))
    Assert(migrationContext.Database.GetMigrations().Count() == 14, "All 14 tracked migrations must remain compiled and discoverable without a database connection.");
var openApiDocument = new OpenApiDocument { Info = new OpenApiInfo { Title = "Deployment check", Version = "v1" }, Paths = new OpenApiPaths() };
using (var documentText = new StringWriter())
{
    openApiDocument.SerializeAsV3(new OpenApiJsonWriter(documentText));
    using var document = JsonDocument.Parse(documentText.ToString());
    Assert(document.RootElement.GetProperty("info").GetProperty("version").GetString() == "v1", "The patched OpenAPI 2.x package must serialize the API document format.");
}
Console.WriteLine("Deployment checks passed: fail-closed settings, exact CORS preflights, JWT round trips, 14 compiled migrations, OpenAPI serialization.");

CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("es-AR");
var chatRequestValidator = new ChatRequestDtoValidator();
Assert(chatRequestValidator.Validate(new ChatRequestDto("", null, [imageDataUrl])).IsValid, "An image-only chat request must pass request validation.");
Assert(chatRequestValidator.Validate(new ChatRequestDto("Read this image", null, [imageDataUrl])).IsValid, "An image-and-text chat request must pass request validation.");
Assert(chatRequestValidator.Validate(new ChatRequestDto("What is in stock?", null)).IsValid, "A text-only chat request must remain valid.");
Assert(!chatRequestValidator.Validate(new ChatRequestDto("", null)).IsValid, "A text-only empty chat request must remain invalid.");

Assert(AssistantInventoryContext.FormatStock(12m) == "12", "Whole-unit stock should not include a locale-specific decimal separator.");
Assert(AssistantInventoryContext.FormatStock(1.25m) == "1.25", "Fractional stock should use an invariant decimal separator.");
Assert(AssistantInventoryContext.FormatStockChange(12m) == "+12", "Stock increases should use an unambiguous invariant amount.");
Assert(AssistantInventoryContext.FormatStockChange(1.25m) == "+1.25", "Fractional stock increases should use a decimal point.");
Assert(AssistantInventoryContext.FormatStockChange(-2m) == "-2", "Stock decreases should not gain an extra plus sign.");
Assert(AssistantInventoryContext.FormatStockChange(0m) == "sin delta", "Zero stock changes should be treated as no-ops.");

const string stockConsultation = "Solo consulta: ¿cuántas unidades hay del producto TEST Chatbot - Filtro de aceite 1.6, SKU 99100001? Respondé con la cantidad sin ceros decimales innecesarios y sin modificar el inventario.";
Assert(AssistantProductExtractor.IsReadOnlyRequest(stockConsultation), "An explicit stock consultation should bypass proposal flows.");
Assert(!AssistantProductExtractor.HasInventoryWriteIntent(stockConsultation), "A stock consultation must not be treated as a write instruction.");
Assert(AssistantProductExtractor.IsReadOnlyRequest("¿Cuántas unidades hay del producto TEST Chatbot, SKU 99100001?"), "A stock question should bypass proposal flows without an explicit no-write phrase.");
Assert(!AssistantProductExtractor.HasInventoryWriteIntent("¿Cuántas unidades hay del producto TEST Chatbot, SKU 99100001?"), "A stock question must not become a proposal because it includes a SKU.");
Assert(!AssistantProductExtractor.HasInventoryWriteIntent("¿Hay 5 unidades del producto TEST Chatbot, SKU 99100001?"), "A question that mentions a quantity must not be treated as a restock.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Reponé 5 unidades del producto TEST Chatbot, SKU 99100001."), "An explicit restock command should remain eligible for a proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("TEST Chatbot, 5 unidades."), "An unambiguous quantity statement should remain eligible for a proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Me llegaron 5 filtros de aceite."), "A received-stock instruction should remain eligible for a proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Actualizá el precio del filtro de aceite a 1500."), "An explicit price-update command should remain eligible for a proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Reponé 5 unidades sin modificar el precio."), "A stock adjustment should remain eligible when the user excludes a price change.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Descontar 3 unidades del producto TEST Chatbot."), "An explicit stock decrease should remain eligible for a proposal.");
Assert(DeepSeekAssistantProvider.SystemPrompt.Contains("separadores de miles", StringComparison.Ordinal), "DeepSeek should preserve unambiguous inventory quantity formatting.");
Assert(OpenAiAssistantProvider.SystemPrompt.Contains("separadores de miles", StringComparison.Ordinal), "OpenAI should preserve unambiguous inventory quantity formatting.");

using var mockHttpClient = new HttpClient();
using var loggerFactory = LoggerFactory.Create(_ => { });
var mockConfiguration = new ConfigurationBuilder()
    .AddInMemoryCollection(new Dictionary<string, string?> { ["Assistant:Provider"] = "mock" })
    .Build();
var mockExtractor = new AssistantProductExtractor(mockConfiguration, mockHttpClient, loggerFactory.CreateLogger<AssistantProductExtractor>());
var extractedDecrease = await mockExtractor.ExtractAsync("Descontar 3 del producto TEST Chatbot", Array.Empty<ChatMessage>(), string.Empty, CancellationToken.None);
Assert(extractedDecrease.Count == 1 && extractedDecrease[0].StockDelta == -3m, "The mock extractor should preserve a subtractive command as a negative delta.");
var extractedRestock = await mockExtractor.ExtractAsync("Reponer 5 unidades del producto TEST Chatbot", Array.Empty<ChatMessage>(), string.Empty, CancellationToken.None);
Assert(extractedRestock.Count == 1 && extractedRestock[0].StockDelta == 5m, "The mock extractor should preserve positive restocks.");

var inconsistentExtraction = new List<RawProductExtract> { new("TEST Chatbot", null, null, 3m, null, null, null) };
Assert(AssistantProductExtractor.TryNormalizeStockDirections("Descontar 3 unidades del producto TEST Chatbot", inconsistentExtraction, out var correctedExtraction), "A single clear subtractive command should have a trusted direction.");
Assert(correctedExtraction[0].StockDelta == -3m, "The trusted boundary should correct an unsigned positive LLM delta for a subtractive command.");
Assert(!AssistantProductExtractor.TryNormalizeStockDirections("Reponé 5 unidades del producto A y descontar 2 unidades del producto B", inconsistentExtraction, out _), "Mixed increase and decrease requests must fail safe instead of sharing one sign.");
Assert(AssistantProductExtractor.HasStockMovementIntent("Sí, dale, descontar 3 unidades del producto TEST Chatbot"), "A stock command appended to confirmation text must not be treated as a bare confirmation.");
var inconsistentCreate = new List<RawProductExtract> { new("TEST New Product", null, null, -4m, null, null, null) };
Assert(AssistantProductExtractor.TryNormalizeStockDirections("Crear producto TEST New Product con 4 unidades", inconsistentCreate, out var correctedCreate), "A create request should have a trusted positive initial-stock direction.");
Assert(correctedCreate[0].StockDelta == 4m, "The trusted boundary should preserve positive initial stock for create flows.");

var stockGuardProduct = new Product("CHECK-STOCK", "Stock Guard Check", 1m);
stockGuardProduct.AdjustStock(2m);
var rejectedNegativeStock = false;
try
{
    stockGuardProduct.AdjustStock(-3m);
}
catch (ArgumentException)
{
    rejectedNegativeStock = true;
}
Assert(rejectedNegativeStock && stockGuardProduct.Stock == 2m, "The existing product stock invariant should reject a decrease below zero without changing stock.");

Assert(!AssistantProposalService.HasActionableExistingChanges(12m, null, null, false), "An existing product with no requested changes should not produce a proposal.");
Assert(!AssistantProposalService.HasActionableExistingChanges(12m, 12m, 0m, false), "A zero stock delta and unchanged price should not produce a proposal.");
Assert(AssistantProposalService.HasActionableExistingChanges(12m, null, 5m, false), "A nonzero stock adjustment should remain actionable.");
Assert(AssistantProposalService.HasActionableExistingChanges(12m, 13m, null, false), "A real price update should remain actionable without a stock delta.");
Assert(AssistantProposalService.HasActionableExistingChanges(12m, null, 0m, true), "A category change should remain actionable without a stock delta.");

var stockProposal = new ProposalResponse(
    [new ProductProposal("CHECK-STOCK", null, null, 2m, null, null, null, true, Guid.NewGuid(), 0m, 1m, [], "restock")],
    "Confirm stock adjustment",
    true,
    false);
var priceProposal = new ProposalResponse(
    [new ProductProposal("CHECK-STOCK", null, 20m, null, null, null, null, true, Guid.NewGuid(), 10m, 1m, [], "price_update")],
    "Confirm price update",
    true,
    false);
Assert(AssistantService.CanExecuteProposal(priceProposal, false), "Stock permission must not block non-stock assistant proposals.");
Assert(!AssistantService.CanExecuteConfirmedProposal("Prepare this proposal", stockProposal, true), "A prepared proposal must not execute before explicit confirmation.");
Assert(!AssistantService.CanExecuteConfirmedProposal("Sí, confirmo", stockProposal, false), "An employee must not confirm stock changes.");
Assert(AssistantService.CanExecuteConfirmedProposal("Sí, confirmo", stockProposal, true), "An administrator may explicitly confirm a complete stock proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Describe this list and import it"), "An explicit import instruction must not be lost when paired with a visual description request.");
Assert(!AssistantProductExtractor.HasInventoryWriteIntent("Don't import this list; describe it"), "A negated import instruction must remain read-only.");
Assert(!AssistantProductExtractor.HasInventoryWriteIntent("Should I import this list?"), "A visual question about importing must not become an implicit write request.");
Assert(!AssistantProposalService.ShouldUseTolerantNameMatch(true, false, null, "99999", "Existing Product") &&
    !AssistantProposalService.ShouldUseTolerantNameMatch(false, false, null, "99999", "Existing Product"), "An explicit or image-origin SKU must not fall back to matching a different product by name.");
Assert(AssistantProposalService.DoesExistingSkuMatch("01234", "01234") &&
    !AssistantProposalService.DoesExistingSkuMatch("01234", "99999"), "Confirmation must validate the proposal SKU against the actual product SKU.");

var gateBusinessId = Guid.NewGuid();
var gateUserId = Guid.NewGuid();
var firstGateEntered = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
var releaseFirstGate = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
var secondGateEntered = false;
var firstGateTask = AssistantService.WithProposalGateAsync(gateBusinessId, gateUserId, async () =>
{
    firstGateEntered.TrySetResult(true);
    await releaseFirstGate.Task;
    return 1;
}, CancellationToken.None);
await firstGateEntered.Task;
var secondGateTask = AssistantService.WithProposalGateAsync(gateBusinessId, gateUserId, () =>
{
    secondGateEntered = true;
    return Task.FromResult(2);
}, CancellationToken.None);
var secondWasBlocked = !secondGateEntered;
releaseFirstGate.TrySetResult(true);
var gateResults = await Task.WhenAll(firstGateTask, secondGateTask);
Assert(secondWasBlocked && secondGateEntered && gateResults.SequenceEqual([1, 2]), "Concurrent requests for the same business/user proposal must serialize through one gate.");

using var confirmationCache = new MemoryCache(new MemoryCacheOptions());
var confirmationBusinessId = Guid.NewGuid();
var confirmationUserId = Guid.NewGuid();
var confirmationCacheKey = $"assistant:lastProposal:{confirmationBusinessId}:{confirmationUserId}";
confirmationCache.Set(confirmationCacheKey, stockProposal);
var confirmationEntered = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
var releaseConfirmation = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
var simulatedStockWrites = 0;
async Task<bool> ConfirmOnce()
{
    return await AssistantService.WithProposalGateAsync(confirmationBusinessId, confirmationUserId, async () =>
    {
        if (!confirmationCache.TryGetValue<ProposalResponse>(confirmationCacheKey, out var current) ||
            !AssistantService.IsSamePendingProposal(current, stockProposal)) return false;
        confirmationEntered.TrySetResult(true);
        await releaseConfirmation.Task;
        Interlocked.Increment(ref simulatedStockWrites);
        confirmationCache.Remove(confirmationCacheKey);
        return true;
    }, CancellationToken.None);
}
var firstConfirmation = ConfirmOnce();
await confirmationEntered.Task;
var secondConfirmation = ConfirmOnce();
var secondConfirmationWaited = !secondConfirmation.IsCompleted;
releaseConfirmation.TrySetResult(true);
var confirmationResults = await Task.WhenAll(firstConfirmation, secondConfirmation);
Assert(secondConfirmationWaited && confirmationResults.Count(result => result) == 1 && simulatedStockWrites == 1,
    "Two simultaneous confirmations of one pending proposal must apply its stock delta only once.");

using var proposalCache = new MemoryCache(new MemoryCacheOptions());
var imageProposalBusinessId = Guid.NewGuid();
var imageProposalUserId = Guid.NewGuid();
var imageProposalCacheKey = $"assistant:lastProposal:{imageProposalBusinessId}:{imageProposalUserId}";
proposalCache.Set(imageProposalCacheKey, stockProposal);
Assert(AssistantService.InvalidatePendingProposalForImage(proposalCache, imageProposalBusinessId, imageProposalUserId) &&
    !proposalCache.TryGetValue<ProposalResponse>(imageProposalCacheKey, out _), "Receiving an image must invalidate an older pending proposal before extraction.");
var freshProposal = priceProposal with { NaturalReply = "Fresh image proposal" };
proposalCache.Set(imageProposalCacheKey, freshProposal);
Assert(proposalCache.TryGetValue<ProposalResponse>(imageProposalCacheKey, out var cachedFreshProposal) &&
    ReferenceEquals(cachedFreshProposal, freshProposal), "A proposal cached after image invalidation must remain available for confirmation.");
Assert(!AssistantService.IsSamePendingProposal(freshProposal, stockProposal) &&
    AssistantService.IsSamePendingProposal(freshProposal, freshProposal), "A confirmation may only act on the proposal observed when its request began.");

var transactionState = new List<string> { "before" };
var originalTransactionState = transactionState.ToArray();
var rollbackCalled = false;
var commitCalled = false;
var atomicFailureObserved = false;
try
{
    await AssistantProposalService.ExecuteAtomicallyAsync(
        _ => { commitCalled = true; return Task.CompletedTask; },
        _ =>
        {
            rollbackCalled = true;
            transactionState.Clear();
            transactionState.AddRange(originalTransactionState);
            return Task.CompletedTask;
        },
        () =>
        {
            transactionState.Add("first row");
            transactionState.Add("second row");
            return Task.FromException<string>(new InvalidOperationException("simulated provider failure"));
        },
        CancellationToken.None);
}
catch (InvalidOperationException)
{
    atomicFailureObserved = true;
}
Assert(atomicFailureObserved && rollbackCalled && !commitCalled && transactionState.SequenceEqual(originalTransactionState), "A failed multi-row transaction must roll back every staged row and never report a commit.");

var employeeAssistant = new CaptureAssistantService();
var employeeController = CreateAssistantController(employeeAssistant, "User");
var employeeChatResult = await employeeController.Chat(new ChatRequestDto(stockConsultation, null), CancellationToken.None);
Assert(employeeChatResult is OkObjectResult && employeeAssistant.LastMessage == stockConsultation, "Employees must retain read-only assistant chat access.");
Assert(employeeAssistant.CanConfirmStockAdjustments == false, "An employee principal must not authorize assistant stock confirmation.");

var emptyTextAssistant = new CaptureAssistantService();
var emptyTextResult = await CreateAssistantController(emptyTextAssistant, "User").Chat(new ChatRequestDto("", null), CancellationToken.None);
Assert(emptyTextResult is BadRequestObjectResult && emptyTextAssistant.LastMessage == null, "Text-only empty chat requests must still be rejected before reaching the assistant service.");

var imageOnlyAssistant = new CaptureAssistantService();
var imageOnlyResult = await CreateAssistantController(imageOnlyAssistant, "User").Chat(new ChatRequestDto("", null, [imageDataUrl]), CancellationToken.None);
Assert(imageOnlyResult is OkObjectResult && imageOnlyAssistant.LastMessage == string.Empty, "Image-only chat must reach the assistant service with an empty user message.");
Assert(imageOnlyAssistant.LastImages.Count == 1, "Image-only chat must preserve its image through the controller.");

const string imageTextMessage = "  Read this image exactly  ";
var imageTextAssistant = new CaptureAssistantService();
var imageTextResult = await CreateAssistantController(imageTextAssistant, "User").Chat(new ChatRequestDto(imageTextMessage, null, [imageDataUrl]), CancellationToken.None);
Assert(imageTextResult is OkObjectResult && imageTextAssistant.LastMessage == imageTextMessage, "Image-and-text chat must preserve the user's exact text.");
Assert(imageTextAssistant.LastImages.Count == 1, "Image-and-text chat must preserve its image through the controller.");
Assert(!AssistantService.CanExecuteProposal(stockProposal, employeeAssistant.CanConfirmStockAdjustments == true), "Employees must not execute assistant stock adjustments.");

var adminAssistant = new CaptureAssistantService();
var adminController = CreateAssistantController(adminAssistant, "Admin");
var adminChatResult = await adminController.Chat(new ChatRequestDto("Sí, confirmo", null), CancellationToken.None);
Assert(adminChatResult is OkObjectResult && adminAssistant.CanConfirmStockAdjustments == true, "An administrator principal must authorize assistant stock confirmation.");
Assert(AssistantService.CanExecuteProposal(stockProposal, adminAssistant.CanConfirmStockAdjustments == true), "Administrators must be able to confirm assistant stock adjustments.");

var stockAdjustmentAuthorization = typeof(ProductsController)
    .GetMethod(nameof(ProductsController.AdjustStock))?
    .GetCustomAttribute<AuthorizeAttribute>();
Assert(stockAdjustmentAuthorization?.Roles == "Admin", "The direct stock-adjustment endpoint must require the Admin role.");

Assert(AssistantImageValidator.TryParse([imageDataUrl], out var images, out _), "Valid JPEG data URL should be accepted.");
Assert(images.Count == 1 && images[0].ContentType == "image/jpeg", "Parsed image metadata should be preserved.");
Assert(!AssistantImageValidator.TryParse(["data:text/plain;base64,YQ=="], out _, out _), "Unsupported media type should be rejected.");
Assert(!AssistantImageValidator.TryParse(["data:image/jpeg;base64,not-base64"], out _, out _), "Malformed base64 should be rejected.");

var oversizedPayload = new string('A', ((AssistantImageValidator.MaxImageBytes + 2) / 3) * 4 + 4);
Assert(!AssistantImageValidator.TryParse([$"data:image/jpeg;base64,{oversizedPayload}"], out _, out _), "Oversized image should be rejected before decoding.");

var handler = new CaptureHandler();
using var httpClient = new HttpClient(handler);
var configuration = new ConfigurationBuilder()
    .AddInMemoryCollection(new Dictionary<string, string?> { ["DEEPSEEK_API_KEY"] = "test-only-key" })
    .Build();
var provider = new DeepSeekAssistantProvider(httpClient, configuration);
const string providerImageText = "  Describe this image exactly  ";
await provider.GetResponseAsync(providerImageText, Array.Empty<ChatMessage>(), string.Empty, images, CancellationToken.None);

using var request = JsonDocument.Parse(handler.RequestBody ?? throw new InvalidOperationException("Provider did not send a request."));
var root = request.RootElement;
Assert(root.GetProperty("model").GetString() == "deepseek-flash", "The vision-capable model should be the fallback.");
var userMessage = root.GetProperty("messages").EnumerateArray().Last();
var content = userMessage.GetProperty("content");
Assert(content.ValueKind == JsonValueKind.Array, "Image messages should use content parts.");
var parts = content.EnumerateArray().ToArray();
Assert(parts.Length == 2, "Image messages should include text and image parts.");
Assert(parts[0].GetProperty("type").GetString() == "text", "The first content part should be text.");
Assert(parts[0].GetProperty("text").GetString() == providerImageText, "Image-and-text provider payloads should preserve the user's exact text.");
Assert(parts[1].GetProperty("type").GetString() == "image_url", "The second content part should be an image.");
Assert(parts[1].GetProperty("image_url").GetProperty("url").GetString() == imageDataUrl, "The image data URL should reach the provider payload.");

var imageOnlyHandler = new CaptureHandler();
using var imageOnlyClient = new HttpClient(imageOnlyHandler);
var imageOnlyProvider = new DeepSeekAssistantProvider(imageOnlyClient, configuration);
await imageOnlyProvider.GetResponseAsync(string.Empty, Array.Empty<ChatMessage>(), string.Empty, images, CancellationToken.None);
using (var imageOnlyRequest = JsonDocument.Parse(imageOnlyHandler.RequestBody ?? throw new InvalidOperationException("Image-only provider did not send a request.")))
{
    var imageOnlyContent = imageOnlyRequest.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content");
    var imageOnlyParts = imageOnlyContent.EnumerateArray().ToArray();
    Assert(imageOnlyParts.Length == 1 && imageOnlyParts[0].GetProperty("type").GetString() == "image_url", "Image-only provider payloads must contain no invented text part.");
    Assert(imageOnlyParts[0].GetProperty("image_url").GetProperty("url").GetString() == imageDataUrl, "Image-only provider payloads should preserve the image data URL.");
}

var textOnlyHandler = new CaptureHandler();
using var textOnlyClient = new HttpClient(textOnlyHandler);
var textOnlyProvider = new DeepSeekAssistantProvider(textOnlyClient, configuration);
await textOnlyProvider.GetResponseAsync("Plain text question", Array.Empty<ChatMessage>(), string.Empty, Array.Empty<AssistantImage>(), CancellationToken.None);
using (var textOnlyRequest = JsonDocument.Parse(textOnlyHandler.RequestBody ?? throw new InvalidOperationException("Text-only provider did not send a request.")))
{
    var textOnlyContent = textOnlyRequest.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content");
    Assert(textOnlyContent.ValueKind == JsonValueKind.String && textOnlyContent.GetString() == "Plain text question", "Text-only provider payloads should remain plain text.");
}

const string privateErrorBody = "private prompt and image metadata sentinel";
var errorHandler = new ErrorHandler(privateErrorBody);
using var errorClient = new HttpClient(errorHandler);
var errorProvider = new DeepSeekAssistantProvider(errorClient, configuration);
try
{
    await errorProvider.GetResponseAsync("Describe this image", Array.Empty<ChatMessage>(), string.Empty, images, CancellationToken.None);
    throw new InvalidOperationException("Expected the provider error response to fail.");
}
catch (HttpRequestException ex)
{
    Assert(ex.Message == "DeepSeek error 500.", "Provider errors should expose only the HTTP status code.");
    Assert(!ex.Message.Contains(privateErrorBody, StringComparison.Ordinal), "Provider error bodies must not enter logged exceptions.");
}
Assert(errorHandler.Response?.WasDisposed == true, "Provider error responses should be disposed.");

var extractionErrorHandler = new ErrorHandler(privateErrorBody);
using var extractionErrorClient = new HttpClient(extractionErrorHandler);
var extractionLogger = new CaptureLogger<AssistantProductExtractor>();
var errorExtractor = new AssistantProductExtractor(configuration, extractionErrorClient, extractionLogger);
await AssertThrowsAsync<HttpRequestException>(() => errorExtractor.ExtractAsync("Reponer 5 unidades del producto TEST Chatbot", Array.Empty<ChatMessage>(), string.Empty, CancellationToken.None));
Assert(extractionLogger.Entries.All(entry => !entry.Contains(privateErrorBody, StringComparison.Ordinal)), "Extraction provider error bodies must not enter logs.");
Assert(extractionErrorHandler.Response?.WasDisposed == true, "Extraction provider error responses should be disposed.");

var imageListJson = JsonSerializer.Serialize(new
{
    isProductList = true,
    products = new[]
    {
        new { name = "Olive Oil", sku = "01234", price = 29.95m, stock = 3m },
        new { name = "Rice", sku = "56789", price = 10m, stock = 8m }
    }
});
var imageListHandler = new CaptureHandler(imageListJson);
using var imageListClient = new HttpClient(imageListHandler);
var imageListExtractor = new AssistantProductExtractor(configuration, imageListClient, NullLogger<AssistantProductExtractor>.Instance);
var imageList = await imageListExtractor.ExtractImageListAsync(string.Empty, images, CancellationToken.None);
Assert(imageList.IsProductList && imageList.Products.Count == 2, "An image-only two-row list must return two structured product rows.");
Assert(imageList.Products[0].Sku == "01234" && imageList.Products[0].StockDirectionRequired, "Structured extraction must preserve leading SKU zeroes and leave a generic stock column direction ambiguous.");
var imageProposals = imageList.Products.Select(row => AssistantProposalService.BuildProposalRow(row, null)).ToList();
Assert(imageProposals.All(proposal => proposal is { Exists: false, MissingFields.Count: 0, Action: "create" }), "Complete image rows must become reviewable create proposals without a database write.");
var imageProposal = new ProposalResponse(imageProposals.Select(proposal => proposal!).ToList(), "Review these products", true, false, RequireExactSkuMatch: true);
Assert(imageProposal.Proposals.Count == 2 && imageProposal.NeedsConfirmation && imageProposal.RequireExactSkuMatch, "The image-only two-row extraction must remain a confirmation-required exact-SKU proposal.");
Assert(!JsonSerializer.Serialize(imageProposal).Contains(nameof(ProposalResponse.RequireExactSkuMatch), StringComparison.Ordinal), "Image-origin matching metadata must not change the public proposal JSON contract.");

var imageOnlyPayload = JsonDocument.Parse(imageListHandler.RequestBody ?? throw new InvalidOperationException("Image extraction did not send a request."));
var imagePayloadRoot = imageOnlyPayload.RootElement;
Assert(imagePayloadRoot.GetProperty("response_format").GetProperty("type").GetString() == "json_object", "Image extraction must request structured JSON.");
Assert(imagePayloadRoot.GetProperty("thinking").GetProperty("type").GetString() == "disabled" &&
    imagePayloadRoot.GetProperty("model").GetString() == "deepseek-flash" &&
    imagePayloadRoot.GetProperty("max_tokens").GetInt32() == 1200, "Image extraction must retain the documented non-thinking vision request and its bounded output size.");
var imageOnlyUserContent = imagePayloadRoot.GetProperty("messages").EnumerateArray().Last().GetProperty("content");
Assert(imageOnlyUserContent.ValueKind == JsonValueKind.Array && imageOnlyUserContent.GetArrayLength() == 1, "Image-only extraction must not invent a user text part.");

var modelSignedStockHandler = new CaptureHandler(JsonSerializer.Serialize(new
{
    isProductList = true,
    products = new[] { new { name = "Existing Product", sku = "01234", price = (decimal?)null, stock = 3m, stockDirection = "decrease", stockDirectionEvidence = "Quantity to remove" } }
}));
using var modelSignedStockClient = new HttpClient(modelSignedStockHandler);
var modelSignedStockExtractor = new AssistantProductExtractor(configuration, modelSignedStockClient, NullLogger<AssistantProductExtractor>.Instance);
var modelSignedStock = await modelSignedStockExtractor.ExtractImageListAsync(string.Empty, images, CancellationToken.None);
Assert(modelSignedStock.Products.Single() is { StockDelta: 3m, StockDirectionRequired: true }, "Model-supplied direction and evidence must never sign an image stock amount.");

const string explicitLoadRequest = "Please load this product list";
Assert(AssistantProductExtractor.HasInventoryWriteIntent(explicitLoadRequest), "An explicit English product-load request must enter structured extraction.");
var textImageHandler = new CaptureHandler(imageListJson);
using var textImageClient = new HttpClient(textImageHandler);
var textImageExtractor = new AssistantProductExtractor(configuration, textImageClient, NullLogger<AssistantProductExtractor>.Instance);
var textImageResult = await textImageExtractor.ExtractImageListAsync(explicitLoadRequest, images, CancellationToken.None);
Assert(textImageResult.IsProductList && textImageResult.Products.Count == 2, "An explicit text-plus-image load must use the same structured row extraction.");
using (var textImagePayload = JsonDocument.Parse(textImageHandler.RequestBody ?? throw new InvalidOperationException("Text-image extraction did not send a request.")))
{
    var textImageParts = textImagePayload.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content").EnumerateArray().ToArray();
    Assert(textImageParts.Length == 2 && textImageParts[0].GetProperty("type").GetString() == "text" && textImageParts[0].GetProperty("text").GetString() == explicitLoadRequest, "Text-plus-image extraction must preserve the explicit request alongside the image.");
}
Assert(!AssistantProductExtractor.HasInventoryWriteIntent("Describe and inspect this image"), "Read-only visual requests must stay on normal image chat.");

var nonListHandler = new CaptureHandler(JsonSerializer.Serialize(new { isProductList = false, products = Array.Empty<object>() }));
using var nonListClient = new HttpClient(nonListHandler);
var nonListExtractor = new AssistantProductExtractor(configuration, nonListClient, NullLogger<AssistantProductExtractor>.Instance);
var nonList = await nonListExtractor.ExtractImageListAsync(string.Empty, images, CancellationToken.None);
Assert(!nonList.IsProductList && nonList.Products.Count == 0, "A non-list image must not create a product proposal.");

var imageServiceConfiguration = new ConfigurationBuilder()
    .AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Assistant:Provider"] = "deepseek",
        ["DEEPSEEK_API_KEY"] = "test-only-key"
    })
    .Build();
var staleProposalBusinessId = Guid.NewGuid();
var staleProposalUserId = Guid.NewGuid();
var staleProposalCacheKey = $"assistant:lastProposal:{staleProposalBusinessId}:{staleProposalUserId}";
proposalCache.Set(staleProposalCacheKey, stockProposal);
var nonListAssistant = CreateImageAssistant(
    imageServiceConfiguration,
    new AssistantProductExtractor(imageServiceConfiguration, new HttpClient(new CaptureHandler(JsonSerializer.Serialize(new { isProductList = false, products = Array.Empty<object>() }))), NullLogger<AssistantProductExtractor>.Instance),
    proposalCache,
    new CaptureHandler("Normal visual response"));
var nonListChat = await nonListAssistant.GetResponseAsync(string.Empty, Array.Empty<ChatMessage>(), images, staleProposalBusinessId, staleProposalUserId, true, CancellationToken.None);
Assert(nonListChat.Reply == "Normal visual response" && nonListChat.Proposal is null &&
    !proposalCache.TryGetValue<ProposalResponse>(staleProposalCacheKey, out _), "A new non-list image must clear the old proposal and still use normal visual chat.");

proposalCache.Set(staleProposalCacheKey, stockProposal);
var noRowsAssistant = CreateImageAssistant(
    imageServiceConfiguration,
    new AssistantProductExtractor(imageServiceConfiguration, new HttpClient(new CaptureHandler(JsonSerializer.Serialize(new { isProductList = true, products = Array.Empty<object>() }))), NullLogger<AssistantProductExtractor>.Instance),
    proposalCache,
    new CaptureHandler("Must not be used"));
var noRowsChat = await noRowsAssistant.GetResponseAsync(string.Empty, Array.Empty<ChatMessage>(), images, staleProposalBusinessId, staleProposalUserId, true, CancellationToken.None);
Assert(noRowsChat.Proposal is null && noRowsChat.Reply.Contains("no pude leer filas", StringComparison.OrdinalIgnoreCase) &&
    !proposalCache.TryGetValue<ProposalResponse>(staleProposalCacheKey, out _), "An unreadable image list must clear the old proposal without falling back to a stale confirmation.");

proposalCache.Set(staleProposalCacheKey, stockProposal);
var failedImageAssistant = CreateImageAssistant(
    imageServiceConfiguration,
    new AssistantProductExtractor(imageServiceConfiguration, new HttpClient(new ErrorHandler(privateErrorBody)), NullLogger<AssistantProductExtractor>.Instance),
    proposalCache,
    new CaptureHandler("Must not be used"));
var imageFailureObserved = false;
try
{
    await failedImageAssistant.GetResponseAsync(string.Empty, Array.Empty<ChatMessage>(), images, staleProposalBusinessId, staleProposalUserId, true, CancellationToken.None);
}
catch (HttpRequestException)
{
    imageFailureObserved = true;
}
Assert(imageFailureObserved && !proposalCache.TryGetValue<ProposalResponse>(staleProposalCacheKey, out _), "A provider failure on any new image must still invalidate the older proposal.");

var missingFieldsHandler = new CaptureHandler(JsonSerializer.Serialize(new
{
    isProductList = true,
    products = new[] { new { name = "Partial Product", sku = (string?)null, price = (decimal?)null, stock = (decimal?)null, stockDirection = (string?)null } }
}));
using var missingFieldsClient = new HttpClient(missingFieldsHandler);
var missingFieldsExtractor = new AssistantProductExtractor(configuration, missingFieldsClient, NullLogger<AssistantProductExtractor>.Instance);
var missingFields = await missingFieldsExtractor.ExtractImageListAsync(string.Empty, images, CancellationToken.None);
var missingProposal = AssistantProposalService.BuildProposalRow(missingFields.Products.Single(), null);
Assert(missingProposal is { Sku: null, Price: null, StockDelta: null } &&
    new[] { "Sku", "Price", "Stock" }.All(field => missingProposal.MissingFields.Contains(field)), "Unreadable required fields must remain missing rather than receiving defaults.");

var existingProduct = new Product("01234", "Existing Product", 10m);
existingProduct.AdjustStock(5m);
var ambiguousStockProposal = AssistantProposalService.BuildProposalRow(
    new RawProductExtract("Existing Product", "01234", null, 3m, null, null, null, StockDirectionRequired: true), existingProduct);
Assert(ambiguousStockProposal is { StockDelta: null } && ambiguousStockProposal.MissingFields.Contains("Dirección de stock"), "An existing SKU's generic stock amount must be blocked until its adjustment direction is explicit.");
var mismatchedSkuProposal = AssistantProposalService.BuildProposalRow(
    new RawProductExtract("Existing Product", "99999", null, 2m, null, null, null), existingProduct);
Assert(mismatchedSkuProposal is not null && mismatchedSkuProposal.MissingFields.Contains("El SKU no coincide con el producto encontrado"), "A name-matched product must not accept a different explicit SKU.");
var textStock = new RawProductExtract("Existing Product", "01234", null, 2m, null, null, null);
Assert(AssistantProductExtractor.TryNormalizeStockDirections("Descontar 2 unidades del producto Existing Product SKU 01234", [textStock], out var explicitTextStock) &&
    explicitTextStock.Single().StockDelta == -2m, "An explicit text direction must normalize the amount extracted from text.");
var imageStockRow = new RawProductExtract("Existing Product", "01234", 10m, 8m, null, null, null, StockDirectionRequired: true);
var imageRowWithTextAdjustment = AssistantProposalService.AttachExplicitTextStockDeltas([imageStockRow], explicitTextStock).Single();
var confirmedExistingStock = AssistantProposalService.BuildProposalRow(imageRowWithTextAdjustment, existingProduct);
var newProductInitialStock = AssistantProposalService.BuildProposalRow(imageRowWithTextAdjustment, null);
Assert(confirmedExistingStock is { StockDelta: -2m, MissingFields.Count: 0 }, "Existing SKU adjustments must use the explicit signed amount from text.");
Assert(newProductInitialStock is { StockDelta: 8m, MissingFields.Count: 0 }, "New product initial stock must remain the positive amount from the image.");
var directionOnlyText = new RawProductExtract("Existing Product", "01234", null, null, null, null, null);
var imageRowWithoutTextAmount = AssistantProposalService.AttachExplicitTextStockDeltas([imageStockRow], [directionOnlyText]).Single();
var directionOnlyProposal = AssistantProposalService.BuildProposalRow(imageRowWithoutTextAmount, existingProduct);
Assert(directionOnlyProposal is { StockDelta: null } && directionOnlyProposal.MissingFields.Contains("Dirección de stock"), "A direction without a text amount must not sign the photo's stock amount.");
Assert(!AssistantProductExtractor.HasConsistentStockDirection(
    "Reponer 3 unidades del producto Existing Product y descontar 2 unidades del producto Other"), "Contradictory text directions must block image-backed stock changes.");

var inactiveProduct = new Product("01234", "Existing Product", 10m);
inactiveProduct.Deactivate();
var inactiveImageProposal = AssistantProposalService.BuildProposalRow(imageStockRow, inactiveProduct, blockInactiveProduct: true)
    ?? throw new InvalidOperationException("Expected a blocked proposal for the inactive product.");
Assert(inactiveImageProposal.Exists &&
    inactiveImageProposal.MissingFields.Contains("Producto inactivo; su reactivación debe realizarla un administrador") &&
    !inactiveProduct.IsActive, "An image SKU match must not reactivate an inactive product implicitly.");
var inactivePatchRaw = new RawProductExtract(
    inactiveImageProposal.Name,
    inactiveImageProposal.Sku,
    inactiveImageProposal.Price,
    inactiveImageProposal.StockDelta,
    inactiveImageProposal.Barcode,
    inactiveImageProposal.Description,
    inactiveImageProposal.CategoryNames,
    inactiveImageProposal.MissingFields.Contains("Dirección de stock"),
    BlockInactiveProduct: inactiveImageProposal.MissingFields.Contains("Producto inactivo; su reactivación debe realizarla un administrador"));
var inactivePatchedProposal = AssistantProposalService.BuildProposalRow(inactivePatchRaw, inactiveProduct)
    ?? throw new InvalidOperationException("Expected the inactive-product blocker to survive a text correction.");
Assert(inactivePatchedProposal.MissingFields.Contains("Producto inactivo; su reactivación debe realizarla un administrador"), "Text corrections must not remove the inactive-product administrator guard.");

var duplicateRows = new List<RawProductExtract>
{
    new("First", "01234", 1m, 1m, null, null, null),
    new("Second", "01234", 2m, 1m, null, null, null)
};
var duplicateSkus = AssistantProposalService.FindDuplicateSkus(duplicateRows);
var duplicateProposals = duplicateRows.Select(row => AssistantProposalService.BuildProposalRow(row, null, duplicateSkus.Contains(row.Sku!))).ToList();
Assert(duplicateSkus.Contains("01234") && duplicateProposals.All(proposal => proposal!.MissingFields.Contains("SKU duplicado en la lista")), "Every row with a duplicated SKU must be blocked from confirmation.");

await CheckImageRequestFailuresAsync(imageServiceConfiguration, images);
await CheckOpenRouterAsync(images);

Console.WriteLine("Assistant image proposals, bounded provider requests, cancellation, text-only stock direction, pending invalidation, per-user serialization, inactive-product guards, duplicate SKU, explicit-confirmation, transaction rollback, authorization, provider-error, and OpenRouter free-routing checks passed.");

static async Task CheckOpenRouterAsync(IReadOnlyList<AssistantImage> images)
{
    var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Assistant:Provider"] = "openrouter", ["OpenRouter:ApiKey"] = "test-only-key"
    }).Build();
    using var cache = new MemoryCache(new MemoryCacheOptions());
    using var db = new ReadOnlyCheckContext([]);
    var businessId = Guid.NewGuid();
    var userId = Guid.NewGuid();
    var captured = new List<JsonElement>();
    const string productList = "{\"isProductList\":true,\"products\":[{\"name\":\"Olive Oil\",\"sku\":\"00001\",\"price\":29.95,\"stock\":1.25},{\"name\":\"Rice\",\"sku\":\"00002\",\"price\":10.5,\"stock\":8}]}";
    var handler = new FlowHandler((callNumber, request) =>
    {
        Assert(request.RequestUri?.AbsoluteUri == "https://openrouter.ai/api/v1/chat/completions" && request.Headers.Authorization?.Scheme == "Bearer", "OpenRouter must use its own endpoint and server-side authorization, never DeepSeek.");
        using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
        var payload = body.RootElement;
        captured.Add(payload.Clone());
        Assert(payload.GetProperty("model").GetString() == OpenRouterAssistantProvider.FreeModel && !payload.TryGetProperty("thinking", out _), "Use only the fixed free model; do not leak DeepSeek-specific thinking options.");
        var routing = payload.GetProperty("provider");
        Assert(!routing.GetProperty("allow_fallbacks").GetBoolean() && routing.GetProperty("require_parameters").GetBoolean() &&
            routing.GetProperty("max_price").EnumerateObject().All(price => price.Value.GetString() == "0"), "All requests must forbid paid routes and fallback providers.");
        return FlowHandler.Completion(payload.TryGetProperty("response_format", out var format)
            ? format.GetProperty("type").GetString() == "json_object" && payload.GetProperty("messages")[1].GetProperty("content").ValueKind == JsonValueKind.Array
                ? productList : "{\"products\":[{\"name\":\"Olive Oil\",\"sku\":\"00001\",\"price\":29.95,\"stockDelta\":1.25}]}"
            : "Check response");
    });
    using var client = new HttpClient(handler);
    AssistantService Service(HttpClient http) => new(config, new MockAssistantProvider(config), new OpenAiAssistantProvider(http, config),
        new DeepSeekAssistantProvider(http, config), new OpenRouterAssistantProvider(http, config), new AssistantInventoryContext(db),
        new AssistantProposalService(db, new AssistantProductExtractor(config, http, NullLogger<AssistantProductExtractor>.Instance), null!, null!, NullLogger<AssistantProposalService>.Instance),
        cache, NullLogger<AssistantService>.Instance);
    var service = Service(client);
    var imageOnly = await service.GetResponseAsync("", [], images, businessId, userId, false, CancellationToken.None);
    Assert(imageOnly.Provider == "openrouter" && imageOnly.Proposal is { NeedsConfirmation: true, Proposals.Count: 2 } &&
        imageOnly.Proposal.Proposals[0].Sku == "00001" && imageOnly.Proposal.Proposals[0].StockDelta == 1.25m &&
        imageOnly.Proposal.Proposals[0].Price == 29.95m, "Image-only OpenRouter extraction must produce an exact, reviewable proposal without losing SKU zeroes or fractional units.");
    Assert(captured[^1].GetProperty("messages")[1].GetProperty("content").GetArrayLength() == 1, "Image-only extraction must not add invented user text.");
    const string imageText = "Describe this image exactly";
    var visual = await service.GetResponseAsync(imageText, [], images, businessId, userId, false, CancellationToken.None);
    var visualParts = captured[^1].GetProperty("messages")[1].GetProperty("content");
    Assert(visual.Provider == "openrouter" && visual.Proposal == null && visualParts[0].GetProperty("text").GetString() == imageText &&
        visualParts[1].GetProperty("image_url").GetProperty("url").GetString() == images[0].DataUrl, "Visual chat must send the exact current text and image to OpenRouter.");
    var readOnly = await service.GetResponseAsync("Solo consulta: ¿cuánto stock hay?", [], [], businessId, userId, false, CancellationToken.None);
    Assert(readOnly.Provider == "openrouter" && readOnly.Proposal == null, "Text stock consultations must select OpenRouter without preparing changes.");
    var import = await service.GetResponseAsync("Importar esta lista", [], images, businessId, userId, false, CancellationToken.None);
    Assert(import.Proposal is { NeedsConfirmation: true, Proposals.Count: 2 }, "Explicit text-plus-image import must use structured OpenRouter extraction.");
    var extractor = new AssistantProductExtractor(config, client, NullLogger<AssistantProductExtractor>.Instance);
    var textProducts = await extractor.ExtractAsync("Crear Olive Oil SKU 00001 precio 29.95 con 1.25 unidades", [], "", CancellationToken.None);
    Assert(textProducts is [{ Sku: "00001", Price: 29.95m, StockDelta: 1.25m }], "Text extraction must also use OpenRouter and preserve fractional values.");
    var calls = handler.Calls;
    config["OpenRouter:Model"] = "paid-model";
    await AssertThrowsAsync<NotSupportedException>(() => service.GetResponseAsync("¿Cuánto stock hay?", [], [], businessId, userId, false, CancellationToken.None));
    await AssertThrowsAsync<NotSupportedException>(() => extractor.ExtractImageListAsync("", images, CancellationToken.None));
    await AssertThrowsAsync<NotSupportedException>(() => extractor.ExtractAsync("Crear un producto", [], "", CancellationToken.None));
    Assert(handler.Calls == calls, "Misconfigured paid models must fail before any outbound call.");
    config["OpenRouter:Model"] = null;
    config["OpenRouter:ApiKey"] = null;
    var noKey = await CreateAssistantController(service, "User").Chat(new ChatRequestDto("¿Cuánto stock hay?", null), CancellationToken.None);
    Assert(noKey is BadRequestObjectResult && handler.Calls == calls, "Missing OpenRouter credentials must map to HTTP 400 without calling a provider.");
    config["OpenRouter:ApiKey"] = "test-only-key";
    var throttledHandler = new FlowHandler((_, _) => new HttpResponseMessage(HttpStatusCode.TooManyRequests) { Content = new StringContent("private provider body") });
    using var throttledClient = new HttpClient(throttledHandler);
    var throttled = await CreateAssistantController(Service(throttledClient), "User").Chat(new ChatRequestDto("", null, [images[0].DataUrl]), CancellationToken.None);
    Assert(throttled is ObjectResult { StatusCode: 429 } && throttledHandler.Calls == 1, "OpenRouter capacity errors must report HTTP 429 without retry or another provider.");
    foreach (var invalid in new[] { "{}", "private provider body", "{\"products\":{}}" })
    {
        var invalidHandler = new FlowHandler((_, _) => FlowHandler.Completion(invalid));
        using var invalidClient = new HttpClient(invalidHandler);
        var invalidResult = await CreateAssistantController(Service(invalidClient), "User").Chat(new ChatRequestDto("Crear un producto", null), CancellationToken.None);
        Assert(invalidResult is ObjectResult { StatusCode: 502 } && invalidHandler.Calls == 1, "Invalid OpenRouter text extraction must fail safely without normal-chat fallback.");
    }
    var stalled = new FlowHandler((_, _) => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StalledContent() });
    using var stalledClient = new HttpClient(stalled) { Timeout = TimeSpan.FromMilliseconds(100) };
    await AssertThrowsAsync<TimeoutException>(() => Service(stalledClient).GetResponseAsync("", [], images, businessId, userId, false, CancellationToken.None));
    using var canceled = new CancellationTokenSource(TimeSpan.FromMilliseconds(30));
    await AssertThrowsAsync<OperationCanceledException>(() => Service(stalledClient).GetResponseAsync("", [], images, businessId, userId, false, canceled.Token));
    Assert(db.WriteAttempts == 0 && handler.Calls == 5 && OpenRouterAssistantProvider.RequestBudget == TimeSpan.FromSeconds(90), "OpenRouter paths must remain read-only, finite, and free from speculative retries.");
}

static void Assert(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

static AssistantService CreateImageAssistant(
    IConfiguration configuration,
    AssistantProductExtractor extractor,
    IMemoryCache cache,
    HttpMessageHandler visionHandler)
{
    var proposalService = new AssistantProposalService(
        null!, extractor, null!, null!, NullLogger<AssistantProposalService>.Instance);
    return new AssistantService(
        configuration,
        new MockAssistantProvider(configuration),
        new OpenAiAssistantProvider(new HttpClient(), configuration),
        new DeepSeekAssistantProvider(new HttpClient(visionHandler), configuration),
        new OpenRouterAssistantProvider(new HttpClient(visionHandler), configuration),
        null!,
        proposalService,
        cache,
        NullLogger<AssistantService>.Instance);
}

static async Task CheckImageRequestFailuresAsync(IConfiguration configuration, IReadOnlyList<AssistantImage> images)
{
    using var cache = new MemoryCache(new MemoryCacheOptions());
    var businessId = Guid.NewGuid();
    var userId = Guid.NewGuid();
    var cacheKey = $"assistant:lastProposal:{businessId}:{userId}";
    var catalogProduct = new Product("OTHER-SKU", "Olive Oil", 1m) { BusinessId = businessId };
    using var db = new ReadOnlyCheckContext([catalogProduct]);

    AssistantService CreateService(HttpClient client) => new(
        configuration,
        new MockAssistantProvider(configuration),
        new OpenAiAssistantProvider(client, configuration),
        new DeepSeekAssistantProvider(client, configuration),
        new OpenRouterAssistantProvider(client, configuration),
        new AssistantInventoryContext(db),
        new AssistantProposalService(db,
            new AssistantProductExtractor(configuration, client, NullLogger<AssistantProductExtractor>.Instance),
            null!, null!, NullLogger<AssistantProposalService>.Instance),
        cache, NullLogger<AssistantService>.Instance);

    // An HTTP 200 whose body never finishes must time out, not become a proposal or a retry.
    var stalledHandler = new FlowHandler((_, _) => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StalledContent() });
    using var stalledClient = new HttpClient(stalledHandler) { Timeout = TimeSpan.FromMilliseconds(100) };
    var stalledService = CreateService(stalledClient);
    await AssertThrowsAsync<TimeoutException>(() => stalledService.GetResponseAsync("", [], images, businessId, userId, true, CancellationToken.None));
    Assert(stalledHandler.Calls == 1 && !cache.TryGetValue<ProposalResponse>(cacheKey, out _), "A stalled extraction must not retry or cache a proposal.");
    var timeoutResult = await CreateAssistantController(stalledService, "Admin").Chat(new ChatRequestDto("", null, [images[0].DataUrl]), CancellationToken.None);
    Assert(timeoutResult is ObjectResult { StatusCode: 504 }, "Provider timeouts must map to HTTP 504, not HTTP 500 or success.");

    using var callerCancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(30));
    await AssertThrowsAsync<OperationCanceledException>(() => CreateAssistantController(stalledService, "Admin")
        .Chat(new ChatRequestDto("", null, [images[0].DataUrl]), callerCancellation.Token));
    Assert(callerCancellation.IsCancellationRequested, "Caller cancellation must propagate without being translated into a provider timeout.");
    var canceledContext = new DefaultHttpContext { RequestAborted = callerCancellation.Token };
    var cancellationLogger = new CaptureLogger<ExceptionMiddleware>();
    var cancellationMiddleware = new ExceptionMiddleware(async context =>
    {
        await CreateAssistantController(stalledService, "Admin")
            .Chat(new ChatRequestDto("", null, [images[0].DataUrl]), context.RequestAborted);
    }, cancellationLogger);
    await AssertThrowsAsync<OperationCanceledException>(() => cancellationMiddleware.InvokeAsync(canceledContext));
    Assert(cancellationLogger.Entries.Count == 0 && canceledContext.Response.StatusCode != 500,
        "Request-aborted cancellation must not become a logged HTTP 500 at the exception middleware boundary.");

    var callsBeforeTextTimeout = stalledHandler.Calls;
    var textTimeoutResult = await CreateAssistantController(stalledService, "Admin").Chat(new ChatRequestDto("Reponer 5 unidades SKU CHECK", null), CancellationToken.None);
    Assert(textTimeoutResult is ObjectResult { StatusCode: 504 } && stalledHandler.Calls == callsBeforeTextTimeout + 1,
        "Text extraction timeout must not be swallowed and retried through normal chat.");
    using var textCancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(30));
    await AssertThrowsAsync<OperationCanceledException>(() => CreateAssistantController(stalledService, "Admin")
        .Chat(new ChatRequestDto("Reponer 5 unidades SKU CHECK", null), textCancellation.Token));

    var fallbackBudgetHandler = new FlowHandler((call, _) => call == 1
        ? FlowHandler.Completion("{\"isProductList\":false,\"products\":[]}")
        : new HttpResponseMessage(HttpStatusCode.OK) { Content = new StalledContent() }, TimeSpan.FromSeconds(5));
    using var fallbackBudgetClient = new HttpClient(fallbackBudgetHandler) { Timeout = Timeout.InfiniteTimeSpan };
    using var budgetCheckLimit = new CancellationTokenSource(TimeSpan.FromSeconds(28));
    await AssertThrowsAsync<TimeoutException>(() => CreateService(fallbackBudgetClient)
        .GetResponseAsync("", [], images, businessId, userId, true, budgetCheckLimit.Token));
    Assert(!budgetCheckLimit.IsCancellationRequested && fallbackBudgetHandler.Calls == 2,
        "A valid non-list extraction and its normal visual fallback must share the 25-second budget, including buffered response bodies.");

    foreach (var content in new[] { "", "{", "{}", "[]", "{\"isProductList\":true}", "{\"isProductList\":\"false\",\"products\":[]}" })
    {
        var invalidHandler = new FlowHandler((_, _) => FlowHandler.Completion(content));
        using var client = new HttpClient(invalidHandler);
        var result = await CreateAssistantController(CreateService(client), "Admin").Chat(new ChatRequestDto("", null, [images[0].DataUrl]), CancellationToken.None);
        Assert(result is ObjectResult { StatusCode: 502 } && invalidHandler.Calls == 1,
            "Empty or malformed structured extraction must fail once, not masquerade as a non-list and call vision chat again.");
    }

    var truncatedHandler = new FlowHandler((_, _) => FlowHandler.Completion("{\"isProductList\":true,\"products\":[]}", "length"));
    using var truncatedClient = new HttpClient(truncatedHandler);
    var truncatedResult = await CreateAssistantController(CreateService(truncatedClient), "Admin").Chat(new ChatRequestDto("", null, [images[0].DataUrl]), CancellationToken.None);
    Assert(truncatedResult is ObjectResult { StatusCode: 502 } && truncatedHandler.Calls == 1, "A token-limited completion must not be accepted as a complete extraction.");

    var unavailableHandler = new FlowHandler((_, _) => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable) { Content = new StringContent("private provider error") });
    using var unavailableClient = new HttpClient(unavailableHandler);
    var unavailableService = CreateService(unavailableClient);
    foreach (var request in new[] { new ChatRequestDto("", null, [images[0].DataUrl]), new ChatRequestDto("Reponer 5 unidades SKU CHECK", null) })
    {
        var callsBefore = unavailableHandler.Calls;
        var result = await CreateAssistantController(unavailableService, "Admin").Chat(request, CancellationToken.None);
        Assert(result is ObjectResult { StatusCode: 502 } && unavailableHandler.Calls == callsBefore + 1, "A provider 503 must fail honestly without a second extraction/chat request.");
    }

    const string completeList = "{\"isProductList\":true,\"products\":[{\"name\":\"Olive Oil\",\"sku\":\"01234\",\"price\":29.95,\"stock\":3},{\"name\":\"Rice\",\"sku\":\"56789\",\"price\":10,\"stock\":8}]}";
    var completeHandler = new FlowHandler((_, _) => FlowHandler.Completion(completeList));
    using var completeClient = new HttpClient(completeHandler);
    var completeChat = await CreateService(completeClient).GetResponseAsync("", [], images, businessId, userId, true, CancellationToken.None);
    Assert(completeChat.Proposal is { Proposals.Count: 2, NeedsConfirmation: true, HasMissingData: false, RequireExactSkuMatch: true } &&
        completeChat.Proposal.Proposals.All(row => !row.Exists && row.Action == "create") &&
        completeChat.Proposal.Proposals[0].Sku == "01234" && completeHandler.Calls == 1 &&
        cache.TryGetValue<ProposalResponse>(cacheKey, out var pending) && ReferenceEquals(pending, completeChat.Proposal),
        "The real image extraction -> catalog lookup -> proposal -> pending-cache path must produce two reviewable products without matching a different SKU by name.");

    var unreadableHandler = new FlowHandler((_, _) => FlowHandler.Completion("{\"isProductList\":true,\"products\":[{\"name\":null,\"sku\":null,\"price\":null,\"stock\":null}]}"));
    using var unreadableClient = new HttpClient(unreadableHandler);
    var unreadableChat = await CreateService(unreadableClient).GetResponseAsync("", [], images, businessId, userId, true, CancellationToken.None);
    Assert(unreadableChat.Proposal is null && unreadableChat.Reply.Contains("no pude leer filas", StringComparison.Ordinal) && unreadableHandler.Calls == 1 &&
        !cache.TryGetValue<ProposalResponse>(cacheKey, out _), "Unreadable rows must invalidate the pending proposal and must not call normal vision chat.");
    Assert(db.WriteAttempts == 0 && catalogProduct.Price == 1m && catalogProduct.Stock == 0m, "Image proposal and failure paths must never attempt database writes or mutate catalog products.");
}

static async Task AssertThrowsAsync<T>(Func<Task> action) where T : Exception
{
    try { await action(); }
    catch (T) { return; }
    throw new InvalidOperationException($"Expected {typeof(T).Name}.");
}

static AssistantController CreateAssistantController(IAssistantService assistant, string role)
{
    var user = new ClaimsPrincipal(new ClaimsIdentity(
    [
        new Claim(ClaimTypes.Role, role),
        new Claim("businessId", Guid.NewGuid().ToString()),
        new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
    ],
    "checks"));

    return new AssistantController(assistant, NullLogger<AssistantController>.Instance)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        }
    };
}

sealed class CaptureLogger<T> : ILogger<T>
{
    public List<string> Entries { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        Entries.Add(formatter(state, exception));
        if (exception != null) Entries.Add(exception.ToString());
    }
}

sealed class CaptureAssistantService : IAssistantService
{
    public string CurrentProvider => "mock";
    public string[] AvailableProviders => ["mock"];
    public string? LastMessage { get; private set; }
    public IReadOnlyList<AssistantImage> LastImages { get; private set; } = Array.Empty<AssistantImage>();
    public bool? CanConfirmStockAdjustments { get; private set; }

    public Task<(string Reply, string Provider, ProposalResponse? Proposal)> GetResponseAsync(
        string message,
        IReadOnlyList<ChatMessage> history,
        IReadOnlyList<AssistantImage> images,
        Guid businessId,
        Guid userId,
        bool canConfirmStockAdjustments,
        CancellationToken ct)
    {
        LastMessage = message;
        LastImages = images;
        CanConfirmStockAdjustments = canConfirmStockAdjustments;
        return Task.FromResult<(string Reply, string Provider, ProposalResponse? Proposal)>(("Check response", "mock", null));
    }
}

sealed class CaptureHandler(string responseContent = "Image received") : HttpMessageHandler
{
    public string? RequestBody { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(new { choices = new[] { new { finish_reason = "stop", message = new { content = responseContent } } } }), Encoding.UTF8, "application/json")
        };
    }
}

sealed class ErrorHandler(string body) : HttpMessageHandler
{
    public TrackingResponse? Response { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var response = new TrackingResponse { Content = new StringContent(body) };
        Response = response;
        return Task.FromResult<HttpResponseMessage>(response);
    }
}

sealed class TrackingResponse : HttpResponseMessage
{
    public TrackingResponse() : base(HttpStatusCode.InternalServerError) { }

    public bool WasDisposed { get; private set; }

    protected override void Dispose(bool disposing)
    {
        WasDisposed = true;
        base.Dispose(disposing);
    }
}

sealed class FlowHandler(Func<int, HttpRequestMessage, HttpResponseMessage> respond, TimeSpan? firstResponseDelay = null) : HttpMessageHandler
{
    public int Calls { get; private set; }
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var call = ++Calls;
        if (call == 1 && firstResponseDelay is { } delay) await Task.Delay(delay, cancellationToken);
        return respond(call, request);
    }

    public static HttpResponseMessage Completion(string content, string finishReason = "stop") => new(HttpStatusCode.OK)
    {
        Content = new StringContent(JsonSerializer.Serialize(new { choices = new[] { new { finish_reason = finishReason, message = new { content } } } }), Encoding.UTF8, "application/json")
    };
}

sealed class StalledContent : HttpContent
{
    protected override bool TryComputeLength(out long length) { length = 0; return false; }
    protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) =>
        throw new InvalidOperationException("The HTTP body must be read with cancellation.");
    protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context, CancellationToken cancellationToken)
    {
        await stream.WriteAsync(Encoding.UTF8.GetBytes(" \n"), cancellationToken);
        await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
    }
}

// Only read queries are implemented. There is no configured database provider or connection.
sealed class ReadOnlyCheckContext : ApplicationDbContext
{
    public int WriteAttempts { get; private set; }
    public ReadOnlyCheckContext(IEnumerable<Product> products) : base(new DbContextOptionsBuilder<ApplicationDbContext>().Options)
    {
        Products = new ReadOnlyCheckSet<Product>(products);
    }
    public override int SaveChanges(bool acceptAllChangesOnSuccess) { WriteAttempts++; throw new InvalidOperationException("Checks must not write."); }
    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    { WriteAttempts++; throw new InvalidOperationException("Checks must not write."); }
}

sealed class ReadOnlyCheckSet<T>(IEnumerable<T> rows) : DbSet<T>, IQueryable<T>, IAsyncEnumerable<T> where T : class
{
    private readonly ReadOnlyCheckQuery<T> _query = new(rows);
    public override Microsoft.EntityFrameworkCore.Metadata.IEntityType EntityType => throw new NotSupportedException("No database metadata in read-only checks.");
    Type IQueryable.ElementType => typeof(T);
    Expression IQueryable.Expression => ((IQueryable<T>)_query).Expression;
    IQueryProvider IQueryable.Provider => ((IQueryable<T>)_query).Provider;
    public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default) => _query.GetAsyncEnumerator(cancellationToken);
    public override IQueryable<T> AsQueryable() => _query;
}

sealed class ReadOnlyCheckQuery<T> : EnumerableQuery<T>, IAsyncEnumerable<T>, IQueryable<T>
{
    public ReadOnlyCheckQuery(IEnumerable<T> rows) : base(rows) { }
    public ReadOnlyCheckQuery(Expression expression) : base(expression) { }
    public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default) => new CheckAsyncEnumerator<T>(this.AsEnumerable().GetEnumerator(), cancellationToken);
    IQueryProvider IQueryable.Provider => new ReadOnlyCheckProvider(this);
}

sealed class ReadOnlyCheckProvider(IQueryProvider inner) : IAsyncQueryProvider
{
    public IQueryable CreateQuery(Expression expression) => throw new NotSupportedException();
    public IQueryable<T> CreateQuery<T>(Expression expression) => new ReadOnlyCheckQuery<T>(expression);
    public object? Execute(Expression expression) => inner.Execute(expression);
    public T Execute<T>(Expression expression) => inner.Execute<T>(expression);
    public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        // Inventory context uses CountAsync; all row queries use async enumeration.
        if (typeof(TResult) == typeof(Task<int>)) return (TResult)(object)Task.FromResult(inner.Execute<int>(expression));
        throw new NotSupportedException($"Unexpected async scalar query: {typeof(TResult).Name}");
    }
}

sealed class CheckAsyncEnumerator<T>(IEnumerator<T> inner, CancellationToken cancellationToken) : IAsyncEnumerator<T>
{
    public T Current => inner.Current;
    public ValueTask<bool> MoveNextAsync() { cancellationToken.ThrowIfCancellationRequested(); return ValueTask.FromResult(inner.MoveNext()); }
    public ValueTask DisposeAsync() { inner.Dispose(); return ValueTask.CompletedTask; }
}
