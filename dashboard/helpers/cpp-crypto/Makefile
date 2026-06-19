# Build the Highrock crypto utility.
#   make            -> builds ./crypto (or crypto.exe on Windows)
#   make run        -> builds and prints a sample secret
#   make clean

CXX      ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra
TARGET   := crypto

ifeq ($(OS),Windows_NT)
	TARGET := crypto.exe
endif

$(TARGET): crypto.cpp
	$(CXX) $(CXXFLAGS) -o $(TARGET) crypto.cpp

.PHONY: run clean
run: $(TARGET)
	./$(TARGET) secret

clean:
	rm -f crypto crypto.exe
