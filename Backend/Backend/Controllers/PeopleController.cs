using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PeopleController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public PeopleController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        /// <summary>
        /// Lấy danh sách tất cả người đã đăng ký trong cơ sở dữ liệu
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var people = await _context.People.AsNoTracking().ToListAsync();
            return Ok(people);
        }

        /// <summary>
        /// Lấy thông tin một người theo Id
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var person = await _context.People.FindAsync(id);
            if (person == null)
            {
                return NotFound(new { success = false, message = $"Không tìm thấy người có Id = {id}" });
            }
            return Ok(person);
        }

        /// <summary>
        /// Đăng ký người mới (lưu ảnh vào wwwroot và lưu vector mock vào SQLite)
        /// </summary>
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterPersonDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest(new { success = false, message = "Tên người dùng không được để trống." });
            }

            string? photoUrl = null;

            // 1. Xử lý lưu ảnh Base64 vào thư mục wwwroot/uploads/faces nếu có gửi lên
            if (!string.IsNullOrWhiteSpace(dto.FaceImage))
            {
                try
                {
                    string webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                    string uploadFolder = Path.Combine(webRoot, "uploads", "faces");

                    if (!Directory.Exists(uploadFolder))
                    {
                        Directory.CreateDirectory(uploadFolder);
                    }

                    // Tách header data:image/...;base64, nếu có
                    string base64Data = dto.FaceImage;
                    if (base64Data.Contains(","))
                    {
                        base64Data = base64Data.Substring(base64Data.IndexOf(",") + 1);
                    }

                    byte[] imageBytes = Convert.FromBase64String(base64Data);
                    string fileName = $"{Guid.NewGuid():N}.jpg";
                    string filePath = Path.Combine(uploadFolder, fileName);

                    await System.IO.File.WriteAllBytesAsync(filePath, imageBytes);
                    photoUrl = $"/uploads/faces/{fileName}";
                }
                catch (Exception ex)
                {
                    return BadRequest(new { success = false, message = $"Lỗi xử lý ảnh: {ex.Message}" });
                }
            }

            // 2. Tạo thực thể Person
            var person = new Person
            {
                Name = dto.Name.Trim()
            };

            // 3. Xử lý vector: Nếu client gửi vector thật thì dùng, nếu không tạm thời MOCK 128 số
            if (dto.FaceVector != null && dto.FaceVector.Length > 0)
            {
                person.SetFaceVector(dto.FaceVector);
            }
            else
            {
                // Giả lập (Mock) mảng vector 128 số thực float trong khoảng [-1.0, 1.0]
                var rand = new Random();
                var mockVector = Enumerable.Range(0, 128)
                    .Select(_ => (float)Math.Round(rand.NextDouble() * 2.0 - 1.0, 4))
                    .ToArray();
                person.SetFaceVector(mockVector);
            }

            // 4. Lưu vào Database SQLite
            _context.People.Add(person);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"Đăng ký thành công người dùng: {person.Name}",
                data = new
                {
                    person.Id,
                    person.Name,
                    person.FaceVectorJson,
                    photoUrl
                }
            });
        }

        /// <summary>
        /// Đăng ký người mới bằng cách upload trực tiếp file ảnh (.jpg/.png) từ máy tính
        /// Rất tiện lợi khi test bằng Swagger/Scalar UI, Postman hoặc HTML Form
        /// </summary>
        [HttpPost("register-file")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> RegisterFile([FromForm] string name, IFormFile? faceFile)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return BadRequest(new { success = false, message = "Tên người dùng không được để trống." });
            }

            string? photoUrl = null;

            if (faceFile != null && faceFile.Length > 0)
            {
                try
                {
                    string webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                    string uploadFolder = Path.Combine(webRoot, "uploads", "faces");

                    if (!Directory.Exists(uploadFolder))
                    {
                        Directory.CreateDirectory(uploadFolder);
                    }

                    string ext = Path.GetExtension(faceFile.FileName);
                    if (string.IsNullOrEmpty(ext)) ext = ".jpg";
                    string fileName = $"{Guid.NewGuid():N}{ext}";
                    string filePath = Path.Combine(uploadFolder, fileName);

                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await faceFile.CopyToAsync(stream);
                    }

                    photoUrl = $"/uploads/faces/{fileName}";
                }
                catch (Exception ex)
                {
                    return BadRequest(new { success = false, message = $"Lỗi lưu file ảnh: {ex.Message}" });
                }
            }

            var person = new Person
            {
                Name = name.Trim()
            };

            // Mock vector 128 số
            var rand = new Random();
            var mockVector = Enumerable.Range(0, 128)
                .Select(_ => (float)Math.Round(rand.NextDouble() * 2.0 - 1.0, 4))
                .ToArray();
            person.SetFaceVector(mockVector);

            _context.People.Add(person);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"Đăng ký thành công người dùng: {person.Name}",
                data = new
                {
                    person.Id,
                    person.Name,
                    person.FaceVectorJson,
                    photoUrl
                }
            });
        }

        /// <summary>
        /// API kiểm tra nhận diện khuôn mặt (Tính khoảng cách Euclidean với vector trong DB)
        /// </summary>
        [HttpPost("recognize")]
        public async Task<IActionResult> Recognize([FromBody] RecognizeRequestDto dto)
        {
            var people = await _context.People.AsNoTracking().ToListAsync();
            if (people.Count == 0)
            {
                return Ok(new RecognizeResultDto
                {
                    IsMatched = false,
                    Name = "Chưa có dữ liệu",
                    Message = "Chưa có ai đăng ký trong hệ thống."
                });
            }

            // Vector dùng để đối chiếu: Nếu client truyền thì dùng, nếu không lấy vector mẫu để test
            float[] queryVector;
            if (dto.FaceVector != null && dto.FaceVector.Length > 0)
            {
                queryVector = dto.FaceVector;
            }
            else
            {
                // Mặc định mock lấy vector của người đầu tiên kèm chút nhiễu nhỏ để test khớp
                var firstPersonVector = people[0].GetFaceVector();
                queryVector = firstPersonVector
                    .Select(v => v + (float)(Random.Shared.NextDouble() * 0.05 - 0.025))
                    .ToArray();
            }

            // So khớp khoảng cách Euclidean với từng người trong DB
            double minDistance = double.MaxValue;
            Person? bestMatch = null;

            foreach (var person in people)
            {
                var personVector = person.GetFaceVector();
                if (personVector.Length == 0) continue;

                double distance = CalculateEuclideanDistance(queryVector, personVector);
                if (distance < minDistance)
                {
                    minDistance = distance;
                    bestMatch = person;
                }
            }

            // Ngưỡng phân biệt (Threshold): Thường <= 0.6 là cùng một người
            const double threshold = 0.6;
            bool isMatched = bestMatch != null && minDistance <= threshold;

            var result = new RecognizeResultDto
            {
                IsMatched = isMatched,
                PersonId = isMatched ? bestMatch?.Id : null,
                Name = isMatched ? bestMatch!.Name : "Người lạ / Unknown",
                Distance = Math.Round(minDistance, 4),
                Confidence = Math.Round(Math.Max(0, 100 - (minDistance * 100)), 2),
                Message = isMatched
                    ? $"Điểm danh thành công: {bestMatch!.Name}!"
                    : "Không nhận diện được người này trong danh sách."
            };

            return Ok(result);
        }

        /// <summary>
        /// Xóa người dùng theo Id (để dọn dẹp dữ liệu thử nghiệm)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var person = await _context.People.FindAsync(id);
            if (person == null)
            {
                return NotFound(new { success = false, message = $"Không tìm thấy người có Id = {id}" });
            }

            _context.People.Remove(person);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = $"Đã xóa thành công người dùng {person.Name} (Id: {id})" });
        }

        /// <summary>
        /// Công thức tính khoảng cách Euclidean giữa 2 vector khuôn mặt
        /// </summary>
        private static double CalculateEuclideanDistance(float[] v1, float[] v2)
        {
            int length = Math.Min(v1.Length, v2.Length);
            if (length == 0) return double.MaxValue;

            double sum = 0;
            for (int i = 0; i < length; i++)
            {
                double diff = v1[i] - v2[i];
                sum += diff * diff;
            }
            return Math.Sqrt(sum);
        }
    }
}
