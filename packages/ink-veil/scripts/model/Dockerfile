FROM python:3.12-slim
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY scripts/model/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts/model/convert-and-upload.py convert-and-upload.py
ENTRYPOINT ["python", "convert-and-upload.py"]
