FROM python:3.11
COPY . /usr/src/app 
WORKDIR /usr/src/app
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir -r requirements.txt
CMD ["python", "-u" , "./main.py"]
