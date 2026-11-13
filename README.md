# Website kiểm tra SIC – Lớp Semi3-3 (Render + GitHub)

**Không có thư mục con**: upload tất cả file (`server.js`, `app.js`, `index.html`, `style.css`, `questions.json`, `package.json`, `render.yaml`, `.gitignore`, `README.md`) vào thư mục gốc repository GitHub (Private).

## Chức năng
- 10 bài, 100 câu; **60 giây cho từng câu**; hết giờ tự chuyển khi trang đang mở.
- Mỗi phiên thi trộn ngẫu nhiên **thứ tự 10 câu** và **thứ tự 4 phương án trong từng câu** bằng bộ sinh ngẫu nhiên an toàn trên máy chủ.
- Đáp án chỉ ở máy chủ; sinh viên **chỉ thấy điểm số**, không thấy đáp án.
- Tự động lưu mỗi lượt hoàn thành. Giảng viên xem danh sách, tải **Excel (.xlsx)** hoặc CSV.
- Server tự tạo/cập nhật file Excel sau mỗi lượt nộp, đặt tại `EXCEL_FILE` (mặc định cùng vị trí với `RESULTS_FILE`).
- **PostgreSQL (`DATABASE_URL`) là nơi lưu điểm bền vững khuyến nghị**, vì ổ đĩa của Render Free là tạm thời. Mỗi lần giảng viên tải Excel, file được dựng lại từ cơ sở dữ liệu nên luôn bao gồm các kết quả đã lưu, kể cả sau khi Render restart.
- Phiên thi cũng lưu trong PostgreSQL khi đã cấu hình, giúp tránh mất phiên nếu dịch vụ khởi động lại.

## Triển khai
1. Giải nén ZIP, upload **các file** (không upload ZIP) lên root GitHub repository Private.
2. Trên Render, tạo Web Service từ repository trên: Runtime `Node`, Root Directory trống, Build `npm install`, Start `npm start`.
3. Environment → thêm `ADMIN_KEY` với chuỗi bí mật **ít nhất 12 ký tự**.
4. **Quan trọng**: tạo Render PostgreSQL hoặc DB PostgreSQL bên ngoài, lấy **internal database URL** (nếu cả hai trên Render cùng khu vực) và thêm biến môi trường `DATABASE_URL` vào Web Service. Không đưa URL/mật khẩu vào GitHub.
5. Chọn Deploy; mở URL `https://<ten-dich-vu>.onrender.com`.
6. Làm thử ít nhất hai phiên cùng một bài để quan sát câu và lựa chọn được trộn.
7. Mở **Dành cho giảng viên**, nhập `ADMIN_KEY`, chọn **Xem kết quả**, rồi **Tải Excel (.xlsx)**.

## Giới hạn và lưu ý
- Nếu **không cấu hình `DATABASE_URL`**, ứng dụng vẫn chạy ở chế độ thử nghiệm: kết quả JSON + Excel nằm trên ổ đĩa container tạm thời và phiên thi ở RAM; **có thể mất toàn bộ khi Render restart/redeploy**. Không dùng chế độ này cho thi chính thức.
- `EXCEL_FILE` có thể đặt thành `/var/data/bang-diem-SIC-Semi3-3.xlsx` **chỉ nếu Render service có Persistent Disk gắn tại `/var/data`**. Nếu không, file Excel được tạo tự động nhưng là bản tạm; bản ghi tin cậy nằm trong PostgreSQL.
- Hệ thống hiện xác định sinh viên bằng **họ tên do người làm nhập**; chưa xác thực danh tính, chưa giới hạn số lần thi theo người và chưa chống gian lận bằng xác thực. Nên bổ sung mã sinh viên / xác thực trước kỳ thi chính thức.
- Bộ nhớ máy chủ tự lưu mỗi câu đã trả lời; sau 60 giây, trình duyệt chủ động nộp câu. Nếu sinh viên đóng trình duyệt, phiên có thể bị treo đến khi tiếp tục; bài chưa nộp hết chưa có kết quả trong Excel.
- `ADMIN_KEY` bắt buộc dài ít nhất 12 ký tự, không dùng lại mật khẩu cá nhân.
