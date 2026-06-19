cmake_minimum_required(VERSION 3.15)
project(highrock_crypto CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(crypto crypto.cpp)

if(MSVC)
  target_compile_options(crypto PRIVATE /O2 /W4)
else()
  target_compile_options(crypto PRIVATE -O2 -Wall -Wextra)
endif()
