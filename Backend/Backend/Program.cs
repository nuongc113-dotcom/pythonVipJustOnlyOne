using Backend.Data;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình DbContext kết nối SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=attendance.db"));

// 2. Cấu hình CORS (Cho phép tất cả origin, method, header để Web Frontend / Camera gọi mượt mà)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// 3. Đăng ký Controllers và OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// Tự động kiểm tra và khởi tạo Database SQLite nếu chưa có
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

// Cấu hình HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // Giao diện test API tương tác tại /scalar/v1
}

// Bật Static Files để xem ảnh trong wwwroot (ví dụ: wwwroot/uploads/faces/...)
app.UseStaticFiles();

// app.UseHttpsRedirection(); // Đã tắt để client trong cùng WiFi gọi HTTP mượt mà

// Kích hoạt CORS trước Routing / Authorization
app.UseCors("AllowAll");

app.UseAuthorization();

app.MapControllers();

app.Run();
