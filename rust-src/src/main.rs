mod m01_gradient;
mod m02_divergence;
mod m03_curl;
mod m04_flux;
mod m05_gauss;
mod m06_stokes;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let chapter = args.get(1).map(String::as_str).unwrap_or("all");

    match chapter {
        "01" => m01_gradient::run(),
        "02" => m02_divergence::run(),
        "03" => m03_curl::run(),
        "04" => m04_flux::run(),
        "05" => m05_gauss::run(),
        "06" => m06_stokes::run(),
        "all" | _ => {
            println!("=== Модуль 01: Градиент ===");      m01_gradient::run();
            println!("\n=== Модуль 02: Дивергенция ==="); m02_divergence::run();
            println!("\n=== Модуль 03: Ротор ===");      m03_curl::run();
            println!("\n=== Модуль 04: Поток ===");       m04_flux::run();
            println!("\n=== Модуль 05: Гаусс ===");       m05_gauss::run();
            println!("\n=== Модуль 06: Стокс ===");       m06_stokes::run();
        }
    }
}
