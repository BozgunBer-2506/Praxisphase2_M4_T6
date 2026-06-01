output "ec2_public_ip" {
  value = aws_eip.falkenwacht_eip.public_ip
}

output "rds_endpoint" {
  value = aws_db_instance.falkenwacht_db.address
}

output "ecr_frontend_url" {
  value = aws_ecr_repository.frontend.repository_url
}
