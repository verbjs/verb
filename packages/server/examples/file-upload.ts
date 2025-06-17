import { createServer, json, text, parseBody, saveFile, type MultipartData, type UploadedFile } from "../src/index.ts";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const app = createServer({ port: 3000 });

// Ensure uploads directory exists
if (!existsSync("./uploads")) {
	await mkdir("./uploads", { recursive: true });
}

// Simple file upload endpoint
app.post("/upload", async (req) => {
	try {
		const data = await parseBody(req) as MultipartData;
		
		// Process uploaded files
		const uploadedFiles = [];
		for (const [fieldName, file] of Object.entries(data.files)) {
			if (Array.isArray(file)) {
				// Handle multiple files with same field name
				for (let i = 0; i < file.length; i++) {
					const f = file[i];
					const filename = `${Date.now()}_${i}_${f.name}`;
					await saveFile(f, `./uploads/${filename}`);
					uploadedFiles.push({
						field: fieldName,
						originalName: f.name,
						savedAs: filename,
						size: f.size,
						type: f.type,
					});
				}
			} else {
				// Single file
				const filename = `${Date.now()}_${file.name}`;
				await saveFile(file, `./uploads/${filename}`);
				uploadedFiles.push({
					field: fieldName,
					originalName: file.name,
					savedAs: filename,
					size: file.size,
					type: file.type,
				});
			}
		}

		return json({
			message: "Upload successful",
			fields: data.fields,
			files: uploadedFiles,
		});
	} catch (error) {
		return json({ error: (error as Error).message }, 400);
	}
});

// File upload with validation
app.post("/upload-image", async (req) => {
	try {
		// Custom upload options with stricter limits
		const data = await parseBody(req) as MultipartData;
		
		const image = data.files.image as UploadedFile;
		if (!image) {
			return json({ error: "No image file provided" }, 400);
		}

		// Validate file type
		if (!image.type.startsWith("image/")) {
			return json({ error: "Only image files are allowed" }, 400);
		}

		// Validate file size (max 5MB)
		if (image.size > 5 * 1024 * 1024) {
			return json({ error: "Image must be smaller than 5MB" }, 400);
		}

		// Save with a clean filename
		const extension = image.name.split('.').pop() || 'jpg';
		const filename = `image_${Date.now()}.${extension}`;
		await saveFile(image, `./uploads/${filename}`);

		return json({
			message: "Image uploaded successfully",
			filename,
			size: image.size,
			type: image.type,
		});
	} catch (error) {
		return json({ error: (error as Error).message }, 400);
	}
});

// Multiple file upload endpoint
app.post("/upload-documents", async (req) => {
	try {
		const data = await parseBody(req) as MultipartData;
		
		const documents = data.files.documents;
		if (!documents) {
			return json({ error: "No documents provided" }, 400);
		}

		const files = Array.isArray(documents) ? documents : [documents];
		const savedFiles = [];

		for (const doc of files) {
			// Validate file type (only documents)
			const allowedTypes = [
				'application/pdf',
				'application/msword',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'text/plain',
			];

			if (!allowedTypes.includes(doc.type)) {
				return json({ 
					error: `File ${doc.name} is not a supported document type` 
				}, 400);
			}

			const filename = `doc_${Date.now()}_${Math.random().toString(36).slice(2)}_${doc.name}`;
			await saveFile(doc, `./uploads/${filename}`);
			savedFiles.push({
				originalName: doc.name,
				savedAs: filename,
				size: doc.size,
				type: doc.type,
			});
		}

		return json({
			message: `Successfully uploaded ${savedFiles.length} document(s)`,
			files: savedFiles,
		});
	} catch (error) {
		return json({ error: (error as Error).message }, 400);
	}
});

// Form with file upload
app.post("/profile", async (req) => {
	try {
		const data = await parseBody(req) as MultipartData;
		
		// Extract form fields
		const name = data.fields.name as string;
		const email = data.fields.email as string;
		const bio = data.fields.bio as string;
		
		// Handle optional avatar upload
		let avatarInfo = null;
		if (data.files.avatar) {
			const avatar = data.files.avatar as UploadedFile;
			
			if (!avatar.type.startsWith("image/")) {
				return json({ error: "Avatar must be an image" }, 400);
			}

			const filename = `avatar_${Date.now()}.${avatar.name.split('.').pop()}`;
			await saveFile(avatar, `./uploads/${filename}`);
			
			avatarInfo = {
				filename,
				size: avatar.size,
				type: avatar.type,
			};
		}

		return json({
			message: "Profile updated successfully",
			profile: {
				name,
				email,
				bio,
				avatar: avatarInfo,
			},
		});
	} catch (error) {
		return json({ error: (error as Error).message }, 400);
	}
});

// Upload form HTML (for testing)
app.get("/", () => {
	return new Response(`
<!DOCTYPE html>
<html>
<head>
	<title>Verb File Upload Example</title>
	<style>
		body { font-family: Arial, sans-serif; margin: 40px; }
		form { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; }
		input, textarea { margin: 5px 0; padding: 8px; width: 300px; }
		button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
		button:hover { background: #0056b3; }
		.result { margin-top: 20px; padding: 10px; background: #f8f9fa; border: 1px solid #dee2e6; }
	</style>
</head>
<body>
	<h1>Verb File Upload Examples</h1>
	
	<h2>Single File Upload</h2>
	<form action="/upload" method="post" enctype="multipart/form-data">
		<div>
			<label>Name: <input type="text" name="name" required></label>
		</div>
		<div>
			<label>File: <input type="file" name="file" required></label>
		</div>
		<button type="submit">Upload</button>
	</form>

	<h2>Image Upload (with validation)</h2>
	<form action="/upload-image" method="post" enctype="multipart/form-data">
		<div>
			<label>Image: <input type="file" name="image" accept="image/*" required></label>
		</div>
		<button type="submit">Upload Image</button>
	</form>

	<h2>Multiple Document Upload</h2>
	<form action="/upload-documents" method="post" enctype="multipart/form-data">
		<div>
			<label>Documents: <input type="file" name="documents" multiple accept=".pdf,.doc,.docx,.txt" required></label>
		</div>
		<button type="submit">Upload Documents</button>
	</form>

	<h2>Profile Form with Avatar</h2>
	<form action="/profile" method="post" enctype="multipart/form-data">
		<div>
			<label>Name: <input type="text" name="name" required></label>
		</div>
		<div>
			<label>Email: <input type="email" name="email" required></label>
		</div>
		<div>
			<label>Bio: <textarea name="bio" rows="3"></textarea></label>
		</div>
		<div>
			<label>Avatar: <input type="file" name="avatar" accept="image/*"></label>
		</div>
		<button type="submit">Update Profile</button>
	</form>
</body>
</html>
	`, {
		headers: { "Content-Type": "text/html" },
	});
});

console.log("Upload server running on http://localhost:3000");
console.log("Visit http://localhost:3000 to test file uploads");
