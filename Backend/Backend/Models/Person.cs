using System.Text.Json;

namespace Backend.Models
{
    /// <summary>
    /// Model thực thể Person lưu thông tin người dùng và vector khuôn mặt
    /// </summary>
    public class Person
    {
        /// <summary>
        /// Khóa chính để phân biệt
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Tên người dùng (hiển thị khi nhận diện thành công)
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Chuỗi JSON chứa mảng vector đặc trưng (vd: "[0.045, -0.128, ..., 0.512]")
        /// </summary>
        public string FaceVectorJson { get; set; } = string.Empty;

        /// <summary>
        /// Chuyển chuỗi FaceVectorJson thành mảng số thực float[]
        /// </summary>
        public float[] GetFaceVector()
        {
            if (string.IsNullOrWhiteSpace(FaceVectorJson))
                return Array.Empty<float>();

            try
            {
                return JsonSerializer.Deserialize<float[]>(FaceVectorJson) ?? Array.Empty<float>();
            }
            catch
            {
                return Array.Empty<float>();
            }
        }

        /// <summary>
        /// Chuyển mảng số thực float[] thành chuỗi JSON lưu vào FaceVectorJson
        /// </summary>
        public void SetFaceVector(float[] vector)
        {
            FaceVectorJson = JsonSerializer.Serialize(vector);
        }
    }
}
