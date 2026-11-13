# SIC Semi3-3 – Website kiểm tra (các tệp cùng cấp)

Toàn bộ tệp trong ZIP nằm ở cấp ngoài cùng, không có thư mục con. **Giải nén trước khi upload lên GitHub**. Không upload tệp ZIP nguyên vẹn vì GitHub không tự giải nén.

## Upload lên GitHub
1. Tạo repository **Private** trên https://github.com/new.
2. Trong repository chọn **Add file → Upload files**.
3. Kéo thả **tất cả tệp đã giải nén** vào trang upload (server.js, package.json, render.yaml, index.html, style.css, app.js, questions.json, README.md, .gitignore).
4. Chọn **Commit changes**. Tất cả tệp phải nằm ngay ở thư mục gốc của repository.

## Render
1. Dashboard Render → New → Web Service → Connect GitHub repository.
2. Runtime Node, Branch main, Root Directory để trống.
3. Build Command: `npm install` ; Start Command: `npm start`.
4. Environment Variables → đặt `ADMIN_KEY` thành mật khẩu riêng, dài và không dễ đoán.
5. Deploy. Mở link HTTPS do Render cung cấp.

## Những lưu ý bắt buộc
- Website chứa **10 bài, 100 câu**, mỗi câu 60 giây, chỉ hiện điểm.
- `questions.json` chứa đáp án. Dùng GitHub **Private**, không chuyển repository sang Public. Server chỉ cho phép tải index.html, style.css và app.js; không xuất câu trả lời qua API.
- Mặc định bảng điểm nằm ở `results.json` trên ổ đĩa ứng dụng. **Render có thể xóa dữ liệu này khi deploy hoặc restart**. Để lưu bền vững, cần database hoặc persistent disk. Có thể dùng env `RESULTS_FILE=/var/data/results.json` nếu đã gắn Persistent Disk ở `/var/data`.
- Phiên làm bài nằm trong RAM, sẽ mất khi server khởi động lại. **Chưa phù hợp cho thi chính thức đông người nếu chưa bổ sung lưu phiên thi bền vững, xác thực và hạn chế lượt thi.**
- Nên thử với vài sinh viên trước khi dùng cho cả lớp.

## Biên tập đề kiểm tra (bản cập nhật)
- 100/100 câu đã được biên tập lại: câu hỏi có ngữ cảnh, chú giải thuật ngữ trong câu và lựa chọn khi cần.
- Mỗi câu gồm 4 lựa chọn cùng chủ đề, có phương án gây nhiễu hợp lý và cân bằng độ dài tương đối.
- Không đưa file `questions.json` lên kho mã nguồn Public vì tệp có trường `answer`.
- Nội dung câu hỏi dùng cho giảng dạy, nên được giảng viên rà soát lần cuối trước khi thi chính thức.
