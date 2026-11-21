# SIC Semi3-3 — Một đề thi tổng hợp 30 câu

**Toàn bộ các file nằm cùng cấp**, không có thư mục con trong bản ZIP xuất bản. Giải nén rồi upload tất cả file lên gốc GitHub repository **Private**.

## Đề thi
- 1 đề gồm **30 câu liên tục**; rút ngẫu nhiên **3 câu cho mỗi bài** trong tổng 10 bài học từ ngân hàng 100 câu. Trộn ngẫu nhiên thứ tự 30 câu và thứ tự bốn phương án riêng cho mỗi lượt.
- **45 giây/câu**, tối đa **22 phút 30 giây**. Hết giờ sẽ chuyển câu tiếp theo (cả lúc người dùng trở lại website sau khi đóng tab, máy chủ sẽ xử lý các mốc hết hạn).
- Mỗi câu 1 điểm quy đổi: điểm hệ 10 = số đúng / 30 × 10. Không tiết lộ đáp án trong giao diện sinh viên hoặc API.
- Sinh viên nhập **Họ tên**, lớp cố định **Semi3-3**. Sau khi hoàn thành chỉ thấy **điểm số**.

## Đăng GitHub và chạy Render Free
1. Tạo repository GitHub **Private**, ví dụ `sic-semi3-3-final-30`.
2. Giải nén ZIP, tải từng file trong thư mục giải nén lên gốc repository, không tải ZIP nguyên.
3. Render → New → Web Service → Connect GitHub; Runtime Node, Root Directory trống, Build `npm install`, Start `npm start`.
4. Render → Environment: `ADMIN_KEY` = mật khẩu riêng giảng viên, **ít nhất 12 ký tự**; `DATABASE_URL` = chuỗi kết nối **PostgreSQL Session Pooler** của Supabase (hoặc Render PostgreSQL). Hai biến này là độc lập, không dùng lại password của database cho `ADMIN_KEY`.
5. Deploy rồi thử các lượt thi và xem **Dành cho giảng viên → Xem kết quả → Tải Excel (.xlsx)**.

## Dữ liệu và file Excel
- **Kết quả và phiên thi tự động được ghi vào PostgreSQL**, không phụ thuộc ổ đĩa tạm trên Render Free; sau khi nộp xong được ghi chính xác một lần theo mã phiên.
- File **Excel thật (.xlsx)** được tạo mới khi giảng viên bấm tải, từ toàn bộ dữ liệu đã lưu. File **không** tồn tại bền vững trên Render Free; PostgreSQL là nguồn dữ liệu chính. Không cần tự xuất thủ công sau mỗi lượt thi.
- Nếu `DATABASE_URL` chưa cấu hình, website chỉ chạy **chế độ thử nghiệm** bằng file JSON và RAM, có thể mất dữ liệu khi máy chủ khởi động lại. Không dùng để thi chính thức.

## Giới hạn
- Hiện xác định sinh viên bằng họ tên do họ tự nhập; **chưa xác minh danh tính hoặc giới hạn một lượt thi cho mỗi sinh viên**. Cần bổ sung mã sinh viên/xác thực nếu thi tính điểm chính thức.
- Từ ngân hàng 100 câu, các lượt **có thể trùng thứ tự ngẫu nhiên**, nên không cam kết khác tuyệt đối từng cặp sinh viên. Xác suất trùng toàn bộ rất nhỏ.
- Để tránh tải máy chủ khi Render Free ngủ, hãy mở website trước giờ thi và thử tải thử để xác nhận khả năng kết nối.
- `questions.json` chứa đáp án, chỉ có thể đọc từ mã nguồn Private trên GitHub và máy chủ; endpoint public không cấp file này. Tuy vậy người có quyền truy cập repository có thể xem đáp án.
